"""Parse the inspection tool's expressions without evaluating source code."""
import re,json

TOKEN=re.compile(r'\s*("(?:\\.|[^"\\])*"|0x[0-9a-fA-F]+|\d+|[A-Za-z_$][A-Za-z0-9_$]*|==|!=|<=|>=|&&|\|\||<<|>>|[+\-*/%<>&|^!~().,\[\]])')
PREC={'||':1,'&&':2,'|':3,'^':4,'&':5,'==':6,'!=':6,'<':7,'>':7,'<=':7,'>=':7,'<<':8,'>>':8,'+':9,'-':9,'*':10,'/':10,'%':10}
class Parser:
    def __init__(self,s):
        self.tokens=[];self.i=0;pos=0
        while pos<len(s):
            m=TOKEN.match(s,pos)
            if not m:raise ValueError('unparsed expression '+s[pos:pos+80])
            self.tokens.append(m[1]);pos=m.end()
    def peek(self):return self.tokens[self.i] if self.i<len(self.tokens) else ''
    def take(self,w=None):
        t=self.peek()
        if not t or w is not None and t!=w:raise ValueError('expected '+str(w)+' got '+t)
        self.i+=1;return t
    def expr(self,level=0):
        t=self.take()
        if t in ('-','+','!','~'):a=[t,self.expr(11)]
        elif t=='(':a=self.expr();self.take(')')
        elif t.startswith('"'):a=['str',json.loads(t)]
        elif t[0].isdigit():a=int(t,16 if t.startswith('0x') else 10)
        else:a=['ref',t]
        while self.peek() in ('.','[','('):
            t=self.take()
            if t=='.':a=['member',a,self.take()]
            elif t=='[':b=self.expr();self.take(']');a=['index',a,b]
            else:
                args=[]
                if self.peek()!=')':
                    while True:
                        args.append(self.expr())
                        if self.peek()!=',':break
                        self.take(',')
                self.take(')');a=['call',a,args]
        while self.peek() in PREC and PREC[self.peek()]>=level:
            op=self.take();a=[op,a,self.expr(PREC[op]+1)]
        return a
def parse(s):
    p=Parser(s.strip());a=p.expr()
    if p.peek():raise ValueError('trailing expression '+p.peek()+' in '+s)
    return simplify(a)
def path(a):
    if not isinstance(a,list):return ''
    if a[0]=='ref':return a[1]
    if a[0]=='member':return path(a[1])+'.'+a[2]
    if a[0]=='index':return path(a[1])+'[]'
    return ''
def simplify(a):
    if not isinstance(a,list):return a
    if a[0]=='str':return a[1]
    if a[0]=='call':
        result=['call',path(a[1]),[simplify(x) for x in a[2]]]
        if a[1][0]=='member' and a[1][1][0]=='index':result.append(simplify(a[1][1]))
        return result
    if a[0]=='index' and path(a[1]).startswith('global.'):
        return ['v',path(a[1])[7:],simplify(a[2])]
    if a[0]=='ref':return ['v',a[1]]
    if a[0]=='member':return ['v',path(a).removeprefix('global.')]
    return [a[0]]+[simplify(x) for x in a[1:]]
