// One command: regenerate every asset in the dimensionally-exact convention, then run the acceptance gates.
//   node build-all.js
const {execSync}=require('child_process'),path=require('path');
const run=(cmd,cwd)=>{console.log('>',cmd);console.log(execSync(cmd,{cwd,stdio:['ignore','pipe','inherit']}).toString().trim());};
run('node build-assets.js',__dirname);                              // ribbons, devices, ground team badge
run('node make-ocp-abu.js',path.join(__dirname,'..','base-art'));   // OCP coat, sleeve views, builder layout
run('node make-abu-top.js',path.join(__dirname,'..','base-art'));
run('node make-cfu-top.js',path.join(__dirname,'..','base-art'));   // Corporate Field Uniform coat (dark blue BDU style)
run('node make-blues-a.js',path.join(__dirname,'..','base-art'));
run('node make-blues-a-female.js',path.join(__dirname,'..','base-art'));
run('node make-blues-b.js',path.join(__dirname,'..','base-art'));
run('node make-mess-dress.js',path.join(__dirname,'..','base-art'));
run('node make-flight-cap.js',path.join(__dirname,'..','base-art'));   // men's flight caps (p.139)
run('node make-flight-cap-women.js',path.join(__dirname,'..','base-art'));   // women's flight caps (p.140) + legacy aliases
run('node make-senior-layer.js',path.join(__dirname,'..','base-art'));
run('node make-blazer-male.js',path.join(__dirname,'..','base-art'));
run('node make-nameplates-blazer.js',path.join(__dirname,'..','base-art'));   // blazer nameplate extras (adult / cadet)   // men's Corporate Service Dress blazer   // Class B shirt (men) + blouse (women)   // men's Class A service dress coat   // ABU coat, sleeve views, builder layout
run('node make-blazer-extras.js',path.join(__dirname,'..','base-art'));   // regimental tie, bow tie, clasps, CAP crest
run('node make-corp-extras2.js',path.join(__dirname,'..','base-art'));    // tie tab, tie tacks with emblems
run('node make-nameplates-3line.js',path.join(__dirname,'..','base-art'));
run('node make-aviator.js',path.join(__dirname,'..','base-art'));         // aviator shirts, short + long, men + women
run('node make-blazer-female.js',path.join(__dirname,'..','base-art'));
run('node make-overblouse.js',path.join(__dirname,'..','base-art'));      // women's overblouse, short sleeve
run('LONG=1 node make-overblouse.js',path.join(__dirname,'..','base-art'));   // long sleeve
run('node validate-assets.js',__dirname);                           // exits non-zero on any failed gate
