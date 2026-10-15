import re,zlib
def load(path):
    d=open(path,'rb').read()
    objs={}
    for m in re.finditer(rb'(?<![\d])(\d+)\s+(\d+)\s+obj\b',d):
        num=int(m.group(1));s=m.end()
        e=d.find(b'endobj',s)
        body=d[s:e]
        st=re.search(rb'stream\r?\n',body)
        if st and b'<<' in body[:st.start()]:
            dic=body[:st.start()];data=body[st.end():]
            # trim by Length if direct
            L=re.search(rb'/Length\s+(\d+)(?!\s+\d+\s+R)',dic)
            data=data[:int(L.group(1))] if L else data.rsplit(b'endstream',1)[0]
            objs[num]=(dic,data)
        else:
            objs[num]=(body,None)
    # object streams
    for num,(dic,data) in list(objs.items()):
        if data is not None and b'/ObjStm' in dic:
            try: raw=zlib.decompress(data)
            except Exception: continue
            n=int(re.search(rb'/N\s+(\d+)',dic).group(1));first=int(re.search(rb'/First\s+(\d+)',dic).group(1))
            hdr=raw[:first].split();pairs=[(int(hdr[i]),int(hdr[i+1])) for i in range(0,2*n,2)]
            for i,(on,off) in enumerate(pairs):
                end=pairs[i+1][1] if i+1<n else len(raw)-first
                objs[on]=(raw[first+off:first+end],None)
    return d,objs
def stream(objs,num):
    dic,data=objs[num]
    if data is None: return None
    if b'FlateDecode' in dic:
        try: return zlib.decompress(data)
        except Exception:
            return zlib.decompressobj().decompress(data)
    return data
