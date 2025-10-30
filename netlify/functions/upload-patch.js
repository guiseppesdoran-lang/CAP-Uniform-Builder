// netlify/functions/upload-patch.js
// Receives multipart/form-data from your front-end,
// sanitizes image with sharp, stores it to S3, and emails via SendGrid.

const Busboy = require('busboy');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sendgrid = require('@sendgrid/mail');

// ===== Required ENV VARS (set in Netlify dashboard) =====
// S3_REGION, S3_BUCKET, SENDGRID_API_KEY, EMAIL_FROM
// Optional override: EMAIL_TO (CSV of emails)
// Optional AWS creds (if not using a Netlify/AWS integration): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

const S3_REGION = process.env.S3_REGION;
const S3_BUCKET = process.env.S3_BUCKET;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'cap-builder@example.com';
const EMAIL_TO = (process.env.EMAIL_TO || 'guiseppe.s.doran@gmail.com,658773@tncap.us')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!S3_REGION || !S3_BUCKET || !SENDGRID_API_KEY) {
  console.warn('Missing env vars: S3_REGION, S3_BUCKET, or SENDGRID_API_KEY');
}

const s3 = new S3Client({ region: S3_REGION });
sendgrid.setApiKey(SENDGRID_API_KEY);

exports.handler = async (event) => {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (!contentType) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing content-type header' }) };
  }

  const bb = Busboy({ headers: { 'content-type': contentType } });
  const fields = {};
  let fileBuffer = null;
  let originalFilename = 'patch.png';

  return await new Promise((resolve) => {
    // Parse file
    bb.on('file', (_, file, info) => {
      const { filename, mimeType } = info || {};
      if (mimeType && !mimeType.startsWith('image/')) {
        file.resume();
        return;
      }
      if (filename) originalFilename = filename;
      const chunks = [];
      file.on('data', c => chunks.push(c));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    // Parse fields
    bb.on('field', (name, val) => { fields[name] = val; });

    // Finish
    bb.on('finish', async () => {
      try {
        if (!fileBuffer || !fileBuffer.length) {
          return resolve({ statusCode: 400, body: JSON.stringify({ message: 'No file uploaded' }) });
        }

        // Sanitize & resize → PNG
        const safeBuffer = await sharp(fileBuffer)
          .rotate()
          .resize({ width: 2000, height: 2000, fit: 'inside' })
          .png({ quality: 90 })
          .toBuffer();

        const timestamp = Date.now();
        const key = `uploads/patch_${timestamp}.png`;

        // Metadata from front-end
        const uploader = fields.uploaderName || 'anonymous';
        const userAgent = fields.userAgent || (event.headers['user-agent'] || 'unknown');
        const ts = fields.timestamp || new Date().toISOString();
        const wing = fields.wing || 'unspecified';
        const patchName = fields.patchName || 'unnamed';

        // Store to S3 (private) with metadata
        await s3.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: safeBuffer,
          ContentType: 'image/png',
          ACL: 'private',
          Metadata: {
            uploader,
            useragent: userAgent.substring(0, 512),
            timestamp: ts,
            wing,
            patchname: patchName
          }
        }));

        // Email w/ attachment
        const bodyText = [
          'New patch uploaded.',
          '',
          `Uploader: ${uploader}`,
          `Wing: ${wing}`,
          `Patch Name: ${patchName}`,
          `Timestamp: ${ts}`,
          `User-Agent: ${userAgent}`,
          `Original filename: ${originalFilename}`,
          `S3 Key: ${key}`
        ].join('\n');

        await sendgrid.send({
          to: EMAIL_TO,
          from: EMAIL_FROM, // must be a verified sender in SendGrid
          subject: `New patch upload — ${wing} — ${patchName} — ${uploader}`,
          text: bodyText,
          attachments: [{
            content: safeBuffer.toString('base64'),
            filename: (originalFilename || 'patch.png').replace(/\s+/g,'_').replace(/[^A-Za-z0-9._-]/g,''),
            type: 'image/png',
            disposition: 'attachment'
          }]
        });

        resolve({ statusCode: 200, body: JSON.stringify({ ok: true, storedKey: key }) });
      } catch (err) {
        console.error('Upload error', err);
        resolve({ statusCode: 500, body: JSON.stringify({ message: err.message || 'Server error' }) });
      }
    });

    // Feed body to busboy
    const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '', 'utf8');
    bb.end(body);
  });
};

