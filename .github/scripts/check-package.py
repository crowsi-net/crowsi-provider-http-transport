import json,re,sys,tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1]) as archive:
 members=archive.getmembers();assert len(members)<=50
 manifest=json.load(archive.extractfile('package/package.json'))
 assert manifest['name']=='@crowsi/provider-http-transport' and manifest['version']=='0.10.1'
 assert not manifest.get('private') and manifest['publishConfig']=={'registry':'https://registry.npmjs.org','access':'public','provenance':True}
 assert not manifest.get('dependencies') and not manifest.get('optionalDependencies')
 names={m.name for m in members};assert sum(m.size for m in members)<=200000
 for name in ['dist/index.mjs','dist/index.d.mts','dist/abort.mjs','dist/policy.mjs','dist/response.mjs','LICENSE','NOTICE','README.md','SECURITY.md']:assert 'package/'+name in names,name
 for member in members:
  name=PurePosixPath(member.name);assert not name.is_absolute() and '..' not in name.parts
  assert member.isfile() and member.name.startswith('package/')
  assert str(name) in ['package/package.json','package/LICENSE','package/NOTICE','package/README.md','package/README.ja.md','package/SECURITY.md'] or str(name).startswith('package/dist/')
  text=archive.extractfile(member).read().decode('utf-8')
  assert not re.search(r'(?i)(?:/home/|/Users/|/mnt/[a-z]/Users/|[A-Za-z]:\\Users\\|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)',text),member.name
 print(json.dumps({'archive':sys.argv[1],'files':len(members),'bounded_scan':'pass'}))
