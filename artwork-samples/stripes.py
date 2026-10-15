import sys,re,json,os,zlib,struct,subprocess;sys.path.insert(0,'tools')
import pdfobjs as P
d,objs=P.load('capr393.pdf')
MAP=[
 ('silver_medal_of_valor',141,'Silver Medal of Valor'),('bronze_medal_of_valor',142,'Bronze Medal of Valor'),('distinguished_service_award',130,'Distinguished Service Award'),
 ('exceptional_service_award',135,'Exceptional Service Award'),('meritorious_service_award',136,'Meritorious Service Award'),('commander_commendation_award',137,"Commander's Commendation Award"),
 ('cap_achievment_award',131,'CAP Achievement Award'),('lifesaving_award',138,'Certificate of Recognition for Life Saving'),
 ('national_commander_unit_citation_award',140,"National Commander's Unit Citation Award"),('unit_citation_award',139,'Unit Citation Award'),
 ('cadet_certificate_of_proficiency',157,'Cadet Certificate of Proficiency'),('frank_borman_falcon_award',154,'Frank Borman Falcon Award'),('spaatz_award',155,'Gen Carl A. Spaatz Award'),
 ('eaker_award',161,'Gen Ira C. Eaker Award'),('earhart_award',158,'Amelia Earhart Award'),('mitchell_award',162,'Gen Billy Mitchell Award'),
 ('armstrong_achievement',156,'Neil Armstrong Achievement'),('goddard_achievement',163,'Dr. Robert H. Goddard Achievement'),('doolittle_achievement',159,'Gen Jimmy Doolittle Achievement'),
 ('lindbergh_achievement',160,'Charles A. Lindbergh Achievement'),('rickenbacker_achievement',164,'Capt Eddie Rickenbacker Achievement'),('wright_brothers_award',165,'Wright Brothers Award'),
 ('mary_feik_achievement',166,'Mary Feik Achievement'),('hap_arnold_achievement',167,'Gen Hap Arnold Achievement'),('curry_achievement',168,'General J. F. Curry Achievement'),
 ('national_commanders_citation',182,'National Commander Citation'),('cap_gill_robb_wilson_ribbon',183,'Gill Robb Wilson Award'),('cap_paul_e_garber_ribbon',184,'Paul E. Garber Award'),
 ('cap_grover_loening_aerospace_ribbon',177,'Grover Loening Aerospace Award'),('cap_leadership_ribbon',178,'Leadership Award'),('cap_membership_ribbon',179,'Membership Award'),
 ('cap_a_scott_crossfield_ribbon',180,'A. Scott Crossfield Award'),('cap_bridgadier_general_charles_yaeger_ribbon',181,'Brig Gen Charles E. Yeager Award'),
 ('cap_command_service_ribbon',200,'Command Service Ribbon'),('afa_award',201,'AFA Award to Unit Cadet of the Year'),('afsa_award',212,'AFSA Award to Unit Cadet NCO of the Year'),
 ('vfw_officer_award',221,'VFW Cadet Officer of the Year'),('vfw_nco_award',220,'VFW Award to Unit Cadet NCO of the Year'),('red_service_ribbon',222,'Red Service Ribbon'),
 ('search_find_ribbon',223,'Search "Find" Ribbon'),('air_search_and_rescue_ribbon',224,'Air Search and Rescue Ribbon'),('cap_counterdrug_ribbon',225,'Counterdrug Ribbon'),
 ('disaster_relief_ribbon',216,'Disaster Relief Ribbon'),('homeland_security_ribbon',209,'Homeland Security Ribbon'),('cap_cadet_orientation_pilot_ribbon',226,'Cadet Orientation Pilot Ribbon'),
 ('community_service_ribbon',202,'Community Service Ribbon'),('iace_ribbon',203,'International Air Cadet Exchange Ribbon'),('national_cadet_competition_ribbon',217,'National Cadet Competition Ribbon'),
 ('national_color_guard_competition_ribbon',219,'National Color Guard Competition Ribbon'),('cadet_advisory_council_ribbon',204,'Cadet Advisory Council Ribbon'),('cadet_special_activity_ribbon',205,'Cadet Special Activities Ribbon'),
 ('encampment_ribbon',206,'Encampment Ribbon'),('cap_senior_recruiter_ribbon',207,'Senior Recruiter Ribbon'),('cadet_recruiter_ribbon',208,'Cadet Recruiter Ribbon'),
 ('cap_world_war_2_service_ribbon',218,'World War II Service Ribbon'),
]
def read_png(path):
    b=open(path,'rb').read();p=8;idat=b'';W=H=0
    while p<len(b):
        l=struct.unpack('>I',b[p:p+4])[0];t=b[p+4:p+8];dd=b[p+8:p+8+l]
        if t==b'IHDR':W,H=struct.unpack('>II',dd[:8]);ct=dd[9]
        elif t==b'IDAT':idat+=dd
        p+=12+l
    raw=zlib.decompress(idat);ch={2:3,6:4}[ct];st=W*ch;out=bytearray(H*st)
    for y in range(H):
        f=raw[y*(st+1)]
        for x in range(st):
            v=raw[y*(st+1)+1+x];a=out[y*st+x-ch] if x>=ch else 0;u=out[(y-1)*st+x] if y else 0;c=out[(y-1)*st+x-ch] if x>=ch and y else 0
            if f==1:r=v+a
            elif f==2:r=v+u
            elif f==3:r=v+((a+u)>>1)
            elif f==4:
                pp=a+u-c;pa,pb,pc=abs(pp-a),abs(pp-u),abs(pp-c);r=v+(a if pa<=pb and pa<=pc else u if pb<=pc else c)
            else:r=v
            out[y*st+x]=r&255
    return W,H,ch,out
specs=[];missing=[]
os.makedirs('jpg',exist_ok=True)
for rid,obj,name in MAP:
    png=f'pdf_ribbons/obj{obj}.png'
    if not os.path.exists(png):
        dic,data=objs[obj]
        if b'DCTDecode' in dic:
            open(f'jpg/obj{obj}.jpg','wb').write(data.rstrip(b'\r\n'))
            subprocess.run(['sips','-s','format','png',f'jpg/obj{obj}.jpg','--out',f'jpg/obj{obj}.png'],capture_output=True)
            png=f'jpg/obj{obj}.png';src='jpeg'
        else:
            missing.append((rid,obj));continue
    else: src='indexed'
    W,H,ch,px=read_png(png)
    row=H//2
    cols=[tuple(px[(row*W+x)*ch:(row*W+x)*ch+3]) for x in range(W)]
    # vertical uniformity (ignore 1px border rows/cols)
    # run-length with tolerance
    runs=[];tol=40 if src=='jpeg' else 0
    for x,c in enumerate(cols):
        if runs and max(abs(c[i]-runs[-1][0][i]) for i in range(3))<=tol: runs[-1][1]+=1
        else: runs.append([c,1])
    # merge tiny runs (<2px) into neighbour for jpeg
    if src=='jpeg':
        m=[]
        for c,n in runs:
            if n<3 and m: m[-1][1]+=n
            else: m.append([c,n])
        runs=m
    specs.append({'id':rid,'name':name,'pdfObject':obj,'source':src,'imgW':W,'imgH':H,
      'stripes':[{'hex':'%02x%02x%02x'%c,'px':n} for c,n in runs]})
json.dump({'source':'CAPR 39-3, 28 Dec 2012, Attachment 3 (embedded 100x30 ribbon images)','ribbons':specs,'missing':missing},open('cap_ribbon_specs.json','w'),indent=1)
for s in specs: print(s['id'].ljust(44),s['source'][:3],' '.join(f"#{t['hex']}:{t['px']}" for t in s['stripes']))
print('missing',missing)
