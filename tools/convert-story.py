import bisect,collections,json,re,sys
from pathlib import Path
from expressions import parse,path
PROJECT=Path(__file__).resolve().parents[1];PROBE=PROJECT.parent/'clannad-probe'
translations=json.loads((PROBE/'translations.json').read_text('utf8'))
names=json.loads((PROBE/'names.json').read_text('utf8'))
raws=[json.loads(p.read_text('utf8')) for p in sorted((PROBE/'scripts').glob('*.json'))]
scene_ids={d['scene']:int(d['scene'][4:]) for d in raws}
failures=[];refs=set();ignored=collections.Counter();counts=collections.Counter();scene_info={};actual_counts=collections.Counter()
defaults={'＊Ａ':'冈崎','＊Ｂ':'朋也','％Ａ':'渚','％Ｂ':'秋生','％Ｃ':'朋也','％Ｄ':'朋也','％Ｅ':'朋也','％Ｆ':'朋也'}
def clean(s):
    s=s.replace('\\n','\n').replace('＃Ｂ００','♪').replace('＃Ｂ０１','★').replace('＃Ｂ０２','☆').replace('＃Ａ００','◆').replace('・','·')
    for a,b in defaults.items():s=s.replace(a,b)
    # Ruby annotations keep base text; original control marks do not become visible UI.
    s=re.sub(r'<ruby[^>]*>(.*?)</ruby>',r'\1',s,flags=re.I)
    return s
def message(serial):
    r=translations.get(str(int(serial)))
    if r is None:raise ValueError('missing official Chinese ID '+str(serial))
    speaker=r['speaker'].strip().strip('【】')
    speaker=names.get(speaker,speaker).removeprefix('＄')
    return {'speaker':clean(speaker),'text':clean(r['text'])}
def expr(s,ctx):
    try:
        def translate_calls(e):
            if isinstance(e,list) and e:
                if e[0]=='call' and e[1] in ('$mes_sel','$mes_par','$mes'):return message(e[2][0])['text']
                return [translate_calls(x) for x in e]
            return e
        return translate_calls(parse(s))
    except Exception as e:failures.append({'scene':ctx[0],'line':ctx[1],'expression':s,'error':str(e)});return ['unsupported',s]
def serial_from(e):
    m=re.search(r'\$(?:mes|mes_par|mes_sel)\((\d+)',e)
    return int(m[1]) if m else None
def add(ops,o,offset):
    if o is not None:ops.append((offset,o));counts[o['op']]+=1
def relevant_lhs(lhs):
    return re.match(r'global\.(?:[a-zA-Z]\w*\[|(?:inc_|cur_call\.))',lhs) is not None or lhs.startswith('$')
for d in raws:
    sid=scene_ids[d['scene']];pairs=[];handled=set();last_bg='kuro';sample_serials=[]
    line_ranges={}
    for event in d['ops']:
        span=line_ranges.setdefault(event['line'],[event['ofs'],event['ofs']]);span[1]=event['ofs']
    for ev in d['ops']:
        op=ev['op'];s=ev['source'];e=ev['expr'];ofs=ev['ofs'];ln=ev['line'];ctx=(d['scene'],ln)
        # One high-level dialogue instruction replaces multilingual display boilerplate.
        is_mes=re.search(r'(?<![A-Za-z_])@mes(?:_par)?\(',s,re.I) is not None
        if is_mes:
            if op=='CD_COMMAND' and ev.get('_call_name') in ('syscom.return_to_menu','global.returnmenu'):
                add(pairs,{'op':'end'},ofs);continue
            if op=='CD_COMMAND' and ev.get('_call_name') in ('$mes','$mes_par') and ln not in handled:
                serial=serial_from(e)
                if serial is not None:
                    m=message(serial);add(pairs,dict(op='text',**m),ofs);sample_serials.append(serial);handled.add(ln)
            # Closing an outer IF can inherit the last dialogue's line number.
            # Preserve branches leaving that expanded macro; dropping them falls
            # through both arms and can send the player back into a previous block.
            if op in ('CD_GOTO','CD_GOTO_FALSE','CD_GOTO_TRUE'):
                target=ev['target_ofs'];lo,hi=line_ranges[ln]
                if target<lo or target>hi+1:
                    branch={'op':{'CD_GOTO':'goto','CD_GOTO_FALSE':'ifFalse','CD_GOTO_TRUE':'ifTrue'}[op],'to':target}
                    if op!='CD_GOTO':branch['condition']=expr(e,ctx)
                    add(pairs,branch,ofs)
            elif op in ('CD_RETURN','CD_EOF'):add(pairs,{'op':'return'},ofs)
            continue
        o=None
        if op=='CD_ASSIGN' and ' = ' in e:
            lhs,rhs=e.split(' = ',1)
            if relevant_lhs(lhs):
                if 'global.selmsg(' in rhs:
                    ids=[int(x) for x in re.findall(r'\$mes_sel\((\d+)',rhs)]
                    if not ids:
                        failures.append({'scene':d['scene'],'line':ln,'expression':rhs,'error':'non-database selection'})
                    else:o={'op':'choice','id':str(sid)+':'+str(ids[0]),'target':expr(lhs,ctx),'items':[dict(text=message(x)['text'],value=i,serial=x) for i,x in enumerate(ids)]}
                elif 'global.selbtn(' in rhs:
                    call=expr(rhs,ctx)
                    if call[:2]!=['call','global.selbtn']:raise ValueError('unexpected dynamic selection '+rhs)
                    o={'op':'dynamicChoice','id':str(sid)+':button:'+str(ofs),'target':expr(lhs,ctx),'labels':call[2]}
                else:o={'op':'set','target':expr(lhs,ctx),'value':expr(rhs,ctx)}
        elif op in ('CD_GOTO','CD_GOTO_FALSE','CD_GOTO_TRUE','CD_GOSUB'):
            o={'op':{'CD_GOTO':'goto','CD_GOTO_FALSE':'ifFalse','CD_GOTO_TRUE':'ifTrue','CD_GOSUB':'call'}[op],'to':ev['target_ofs']}
            if op in ('CD_GOTO_FALSE','CD_GOTO_TRUE'):o['condition']=expr(e,ctx)
        elif op in ('CD_RETURN','CD_EOF'):o={'op':'return'}
        elif op=='CD_TEXT':o={'op':'text','speaker':'','text':clean(ev.get('text') or '')}
        elif op=='CD_COMMAND':
            name=ev.get('_call_name') or '';args=ev.get('_arg_values') or []
            if name in ('global.jump','global.farcall'):
                target=str(args[0]) if args else ''
                if target in scene_ids:o={'op':'jumpScene' if name=='global.jump' else 'callScene','scene':scene_ids[target],'entry':int(args[1] or 0) if len(args)>1 else 0}
                else:failures.append({'scene':d['scene'],'line':ln,'expression':e,'error':'scene target '+target})
            elif name in ('$haikei_set','$bg_set'):
                if args and isinstance(args[0],str):o={'op':'background','image':args[0].lower()};refs.add(args[0].lower())
            elif name=='$bc00':
                images=[x.lower() for x in args[1:4] if isinstance(x,str) and x.lower() not in ('none','')];refs.update(images);o={'op':'bodies','images':images}
            elif name=='$fg00':o={'op':'bodies','images':[]}
            elif name=='$chr_set':
                if args and isinstance(args[0],str):
                    if args[0].lower()=='bc00':ignored['$chr_set BC00 placeholder']+=1
                    else:
                        image=args[0].lower();refs.add(image)
                        # x=0 changes the central portrait during timed speech.
                        # Noncentral paired portraits remain side by side.
                        o={'op':'bodies','images':[] if image=='kuro' else [image]} if len(args)>1 and args[1]==0 else {'op':'bodyAdd','image':image}
            elif name=='$chr_del_all':o={'op':'bodies','images':[]}
            elif name=='$obj_set' and len(args)>=2 and args[1]==0 and isinstance(args[0],str):o={'op':'background','image':args[0].lower()};refs.add(args[0].lower())
            elif name=='object.create' and args and isinstance(args[0],str):
                # Cinematic illustrations are flattened to one background, not desktop UI objects.
                image=args[0].lower();refs.add(image)
                if image.startswith(('fg','sfwec','spapa','ed')):o={'op':'background','image':image,'clearBody':True}
            elif name.startswith('counter.') and 'start' in name:o={'op':'native','call':expr(e,ctx)}
            elif name in ('syscom.return_to_menu','global.returnmenu'):o={'op':'end'}
            else:ignored[name]+=1
        add(pairs,o,ofs)
    original_offsets=[ofs for ofs,o in pairs]
    pairs=[(ofs,o) for i,(ofs,o) in enumerate(pairs) if not(o['op']=='goto' and bisect.bisect_left(original_offsets,o['to'])==i+1)]
    offsets=[x for x,o in pairs];ops=[o for x,o in pairs]
    actual_counts.update(o['op'] for o in ops)
    if sid in (416,9999,1429):
        source_by_offset={ev['ofs']:{'source':ev['source'],'line':ev['line'],'expr':ev['expr'],'kind':ev['op']} for ev in d['ops']}
        (PROBE/(d['scene']+'.mapping.json')).write_text(json.dumps([{'offset':ofs,'index':i,'converted':o,'source':source_by_offset.get(ofs)} for i,(ofs,o) in enumerate(pairs)],ensure_ascii=False,indent=2),encoding='utf8')
    def cursor(ofs):return bisect.bisect_left(offsets,ofs)
    for o in ops:
        if o['op'] in ('goto','ifFalse','ifTrue','call'):o['to']=cursor(o['to'])
    entries=[cursor(x) for x in d['zLabels']]
    while len(entries)>1 and entries[-1]==entries[1]:entries.pop()
    scene_info[str(sid)]={'id':sid,'source':d['scene'],'length':len(ops),'entries':entries,'textCount':sum(o['op']=='text' for o in ops),'sampleSerials':sample_serials[:3]}
    (PROJECT/'converted-story'/f'{sid}.json').write_text(json.dumps(ops,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    dest=PROJECT/'src/common/story'/str(sid);dest.mkdir(parents=True,exist_ok=True)
    assert dest.resolve().is_relative_to((PROJECT/'src/common/story').resolve())
    blocks=max(1,(len(ops)+511)//512)
    for stale in dest.glob('*.txt'):
        if stale.stem.isdecimal() and int(stale.stem)>=blocks:stale.unlink()
    for n in range(0,len(ops),512):
        (dest/f'{n//512}.txt').write_text(json.dumps(ops[n:n+512],ensure_ascii=False,separators=(',',':')),encoding='utf8')
counts=actual_counts
route_names={0:'共通篇',1:'幻想世界',2:'藤林杏 / 椋',3:'一之濑琴美',4:'伊吹风子',5:'坂上智代',6:'春原结局',7:'春原兄妹',8:'宫泽有纪宁',9:'幸村俊夫',10:'相乐美佐枝',11:'柊胜平',12:'古河家庭 / 补充',13:'古河早苗',14:'芳野祐介',15:'补充篇',16:'演出片段',18:'古河渚',19:'After Story'}
routes=[];chapters=[]
for code,name in route_names.items():
    scenes=[v for v in scene_info.values() if v['textCount'] and any(n//1000000==code for n in v['sampleSerials'])]
    if not scenes:continue
    ri=len(routes);ids=[v['id'] for v in scenes];routes.append({'name':name,'scenes':ids})
    for i,v in enumerate(scenes):
        no=str(v['id']).zfill(4);date=re.search(r'(?:04|[1-6]4)(\d{2})$',no)
        label=name+' · '+('4月'+str(int(date[1]))+'日' if date else '第 '+str(i+1)+' 章')
        v.update(name=label,next=ids[i+1] if i+1<len(ids) else 0,route=ri)
        chapters.append({'id':v['id'],'route':ri,'name':label})
for v in scene_info.values():
    v.setdefault('name',v['source']);v.setdefault('next',0)
catalog={'count':len(scene_info),'initial':414,'flowScene':414,'blockSize':512,'scenes':scene_info,'routes':routes,'chapters':chapters,'dialogue':counts['text'],'choices':counts['choice']+counts['dynamicChoice']}
for v in scene_info.values():v.pop('sampleSerials',None)
(PROJECT/'src/common/catalog.js').write_text('export const catalog='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
report={'sceneCount':len(scene_info),'dialogue':counts['text'],'choices':counts['choice']+counts['dynamicChoice'],'operations':dict(counts),'conversionFailures':failures,'omittedCommands':ignored.most_common(),'imageReferences':sorted(refs),'routes':routes,'chapterCount':len(chapters),'scriptBytes':sum(p.stat().st_size for p in (PROJECT/'src/common/story').rglob('*.txt'))}
(PROJECT/'reports/story-conversion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('CONVERSION',json.dumps({k:v for k,v in report.items() if k not in ('omittedCommands','imageReferences','routes','conversionFailures')},ensure_ascii=False),'failures',len(failures))
if failures:print(json.dumps(failures[:8],ensure_ascii=False))
