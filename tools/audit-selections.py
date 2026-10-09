"""Check all menu orders, Chinese labels and return values against extracted source."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1];probe=root.parent/'clannad-probe'
translations=json.loads((probe/'translations.json').read_text('utf8'))
normal=dynamic=0;rows=[]
for file in sorted((probe/'scripts').glob('*.json')):
    raw=json.loads(file.read_text('utf8'));sid=int(raw['scene'][4:])
    converted=json.loads((root/'converted-story'/f'{sid}.json').read_text('utf8'))
    for event in raw['ops']:
        if event['op']!='CD_ASSIGN' or ' = ' not in event['expr']:continue
        lhs,rhs=event['expr'].split(' = ',1)
        if 'global.selmsg(' not in rhs and 'global.selbtn(' not in rhs:continue
        target=re.fullmatch(r'global\.([fz])\[(\d+)\]',lhs)
        assert target,lhs
        expected=['v',target[1],int(target[2])]
        if 'global.selmsg(' in rhs:
            serials=[int(x) for x in re.findall(r'\$mes_sel\((\d+)',rhs)]
            ident=f'{sid}:{serials[0]}'
            matches=[o for o in converted if o.get('id')==ident]
            assert matches,(file,event)
            for op in matches:
                assert op['target']==expected
                assert [x['serial'] for x in op['items']]==serials
                assert [x['value'] for x in op['items']]==list(range(len(serials)))
                for item in op['items']:
                    # Only the original display-control punctuation normalization is allowed.
                    text=translations[str(item['serial'])]['text'].replace('・','·').replace('\\n','\n')
                    assert item['text']==text,(ident,item['text'],text)
            normal+=1
        else:
            ident=f"{sid}:button:{event['ofs']}"
            op=next(o for o in converted if o.get('id')==ident)
            assert op['op']=='dynamicChoice' and op['target']==expected
            variables=[int(x) for x in re.findall(r'global\.s\[(\d+)\]',rhs)]
            serials=[int(x) for x in re.findall(r'\$mes_sel\((\d+)',rhs)]
            labels=[['v','s',x] for x in variables]+[translations[str(x)]['text'] for x in serials]
            assert op['labels']==labels
            dynamic+=1
        rows.append({'scene':sid,'line':event['line'],'id':ident,'kind':'dynamic' if 'global.selbtn(' in rhs else 'normal'})
assert normal==302 and dynamic==7
report={'result':'passed','normalSelections':normal,'dynamicSelections':dynamic,'total':normal+dynamic,'checks':['source target variable','Chinese database labels','original menu order','zero-based return values'],'locations':rows}
(root/'reports/choice-source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('SOURCE_SELECTIONS_PASSED',normal,dynamic)
