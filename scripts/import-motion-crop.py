"""Extract authored crop channels from the purchased Motion transition sources.

This is a deliberately strict importer, not a general Motion compatibility claim.
Unexpected rendering factories/animated properties fail rather than disappearing.
"""
import hashlib,json,sys,zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

def seconds(text):
 values=[int(v) for v in text.split()]
 assert len(values)==4 and values[1]>0 and values[2:]==[1,0], 'Unsupported Motion time'
 return values[0]/values[1]

def convert(data):
 assert b'<!ENTITY' not in data
 root=ET.fromstring(data)
 factories={f.attrib['id']:f.findtext('description') for f in root.findall('factory')}
 assert set(factories.values())=={'Channel','Widget','Image','Project'}
 layers=root.findall('.//layer'); assert len(layers)==1
 images=layers[0].findall('scenenode')
 assert [factories[i.attrib['factoryID']] for i in images]==['Image','Image']
 assert [i.attrib['name'] for i in images]==['Transition A','Transition B']
 settings=root.find('.//sceneSettings')
 width=int(settings.findtext('width'));height=int(settings.findtext('height'))
 assert width>0 and height>0
 a,b=images
 assert a.find('timing').attrib==b.find('timing').attrib or (
  seconds(a.find('timing').attrib['in'])==seconds(b.find('timing').attrib['in']) and
  seconds(a.find('timing').attrib['out'])==seconds(b.find('timing').attrib['out']) and
  seconds(a.find('timing').attrib['offset'])==seconds(b.find('timing').attrib['offset']))
 assert seconds(a.find('timing').attrib['in'])==0 and seconds(a.find('timing').attrib['offset'])==0
 for image in images:
  props=image.find("parameter[@name='Properties']")
  assert all(p.attrib['name'] in ['Lighting','Shadows','Reflection','Crop','Media','Page Number','Retime Value','Retime Value Cache'] for p in props.findall('parameter'))
  for name in ['Lighting','Shadows','Reflection']:
   prop=props.find(f"parameter[@name='{name}']")
   assert prop is None or not prop.findall('parameter')
  for p in props.findall('parameter'):
   if p.attrib['name'].startswith('Retime'):assert p.attrib.get('value')=='1'
 assert b.find("parameter[@name='Properties']/parameter[@name='Crop']") is None
 crop=a.find("parameter[@name='Properties']/parameter[@name='Crop']")
 assert crop is not None
 assert set(root.findall('.//curve'))==set(crop.findall('.//curve'))
 channels={}
 for param in crop.findall('parameter'):
  name=param.attrib['name'].lower();assert name in ['left','right','top','bottom']
  curve=param.find('curve');assert curve is not None and curve.attrib['type']=='1'
  knots=[]
  for key in curve.findall('keypoint'):
   assert key.attrib['interpolation']=='1' and key.attrib['flags']=='0'
   at=seconds(key.findtext('time'));value=float(key.findtext('value'))
   knot={'at':at,'value':value}
   for prefix,side in [('input','left'),('output','right')]:
    t=key.findtext(prefix+'TangentTime');v=key.findtext(prefix+'TangentValue')
    if t is not None and v is not None:knot[side]=[at+float(t),value+float(v)]
   knots.append(knot)
  assert int(curve.findtext('numberOfKeypoints'))==len(knots)
  channels[name]={'interpolation':'bezier','knots':knots}
  for xml,key in [('min','minimum'),('max','maximum')]:
   if curve.findtext(xml) is not None:channels[name][key]=float(curve.findtext(xml))
 return {'schema':'reel-motion-crop-source-v1','sourceSha256':hashlib.sha256(data).hexdigest(),'width':width,'height':height,'endTime':seconds(a.find('timing').attrib['out']),'crop':channels}

if __name__=='__main__':
 archive=Path(sys.argv[1]); result={}
 with zipfile.ZipFile(archive) as z:
  for direction in ['Up','Down']:
   path=f'Exclusive Transitions/FOUR Editors Transitions/Wipe/Simple Wipe {direction}/Simple Wipe {direction}.motr'
   result['motion-wipe-'+direction.lower()]={**convert(z.read(path)),'sourcePath':archive.name+'!/'+path}
 Path('contracts/native-motion-data.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
 print({key:value['sourceSha256'] for key,value in result.items()})
