"""Generate the illustrative component-addressable Transformer Twin model.
Run: Blender --background --python models/build_transformer.py
No external textures. Coordinates and ratings are illustrative, not engineering CAD.
"""
import bpy, math
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0, rough=.5):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    return m
paint = material('Sage enamel', (.43,.55,.49), .35, .38)
edge = material('Dark hardware', (.16,.23,.21), .65, .35)
porcelain = material('Porcelain', (.64,.69,.61), .1, .27)
copper = material('Copper windings', (.63,.29,.12), .7, .3)
steel = material('Laminated core', (.25,.29,.28), .65, .4)
base = material('Concrete plinth', (.64,.67,.63), 0, .95)
label = material('Nameplate', (.76,.79,.73), .45, .3)
groups = {}
for key in ['tank','windings','bushings','cooling','conservator','tapchanger','foundation']:
    obj = bpy.data.objects.new(key, None)
    bpy.context.collection.objects.link(obj)
    obj['component'] = key
    groups[key] = obj

def finish(obj, name, mat, group, bevel=0):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = groups[group]
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if obj.type == 'MESH':
        for p in obj.data.polygons: p.use_smooth = False
    return obj

def box(name, loc, size, mat=paint, group='tank', bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,group,bevel)

def cyl(name, loc, radius, depth, mat=paint, group='tank', axis='z', vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='x': o.rotation_euler[1]=math.pi/2
    if axis=='y': o.rotation_euler[0]=math.pi/2
    finish(o,name,mat,group,.015)
    for p in o.data.polygons: p.use_smooth = len(p.vertices)==4
    return o

def pipe(name, a, b, radius=.07, group='cooling', mat=paint):
    a,b=Vector(a),Vector(b)
    o=cyl(name,(a+b)/2,radius,(b-a).length,mat,group)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

box('Concrete base',(-.7,0,-.12),(7.6,3.5,.24),base,'foundation',.08)
for x in [-1.55,1.55]: box('Tank skid',(x,0,.12),(.24,2.7,.24),edge,'foundation')
box('Tank floor',(0,0,.35),(4.25,2.25,.18))
box('Front removable panel',(0,-1.1,1.72),(4.2,.12,2.6))
box('Rear tank wall',(0,1.1,1.72),(4.2,.12,2.6))
for x in [-2.05,2.05]: box('End tank wall',(x,0,1.72),(.12,2.2,2.6))
box('Removable tank lid',(0,0,3.08),(4.45,2.45,.15))
for x in [-1.9,-1.4,-.9,-.4,.1,.6,1.1,1.6,1.95]:
    for y in [-1.13,1.13]:
        box('Tank stiffener',(x,y,1.7),(.065,.11,2.35),paint)
        cyl('Lid bolt',(x,y,3.18),.04,.06,edge)
box('Asset plate',(1,-1.177,2.1),(.65,.025,.35),label)
for x in [-1.2,1.2]:
    cyl('Lifting lug',(x,0,3.25),.12,.12,edge,'tank','y')
# Active assembly: rectangular laminated core with two wound legs.
for z in [.7,2.65]: box('Core yoke',(0,0,z),(3.1,.65,.3),steel,'windings')
for x in [-1.15,1.15]:
    box('Core leg',(x,0,1.67),(.35,.6,2),steel,'windings')
    cyl('Winding insulation',(x,0,1.65),.53,1.5,porcelain,'windings')
    for i in range(20):
        bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,location=(x,0,.94+i*.075),major_radius=.53,minor_radius=.044)
        finish(bpy.context.object,'Copper winding turn',copper,'windings')
    pipe('Winding terminal',(x,0,2.4),(x,0,3.05),.045,'windings',copper)
# HV pair and smaller LV terminal.
for x,y,h in [(.25,.55,1.5),(1.45,.55,1.5),(-.5,-.6,.82)]:
    cyl('Bushing flange',(x,y,3.2),.28,.13,edge,'bushings')
    cyl('Porcelain stem',(x,y,3.25+h/2),.11,h,porcelain,'bushings')
    for i in range(round(h/.12)):
        cyl('Porcelain shed',(x,y,3.31+i*.12),.24-i*.004,.055,porcelain,'bushings')
    cyl('Terminal contact',(x,y,3.3+h),.065,.2,copper,'bushings')
# Oil expansion vessel and its pipe.
for x in [-1.7,-.65]: box('Conservator saddle',(x,.65,3.38),(.14,.45,.65),edge,'conservator')
cyl('Conservator vessel',(-1.2,.65,3.95),.39,1.8,paint,'conservator','x',48)
for x in [-2.12,-.28]: cyl('Vessel end cap',(x,.65,3.95),.4,.06,paint,'conservator','x')
cyl('Oil level gauge',(-2.16,.65,3.95),.14,.025,label,'conservator','x')
pipe('Expansion oil line',(-1.2,.65,3.6),(-1.2,.65,3.1),.08,'conservator')
# OFWF heat exchanger skid, connected oil lines and water headers.
for x in [-4.2,-2.75]: box('Cooler foot',(x,0,.15),(.16,1.1,.3),edge,'cooling')
box('Cooler housing',(-3.5,0,.95),(1.8,1,1.3),paint,'cooling')
for x in [-4.25,-4.05,-3.85,-3.65,-3.45,-3.25,-3.05,-2.85]:
    box('Heat exchanger rib',(x,-.55,1),(.06,.14,1.05),edge,'cooling',.012)
for z in [.55,1.35]:
    pipe('Oil connection',(-2.65,.1,z),(-2.05,.1,z),.09)
    pipe('Water header',(-4.45,-.74,z),(-2.6,-.74,z),.08)
    cyl('Water flange',(-4.45,-.74,z),.15,.08,edge,'cooling','x')
# External tap drive cabinet.
box('Tap drive cabinet',(2.38,0,1.65),(.6,1,1.5),paint,'tapchanger')
box('Tap drive door',(2.7,0,1.65),(.04,.87,1.35),label,'tapchanger')
box('Door handle',(2.74,-.28,1.6),(.04,.06,.25),edge,'tapchanger')
cyl('Tap position dial',(2.74,.05,1.96),.14,.03,edge,'tapchanger','x')
pipe('Tap drive conduit',(2.35,0,2.4),(2.35,0,3.1),.05,'tapchanger')
# Save an editable source and a portable model with stable component extras.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/transformer.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/models/transformer.glb'),export_format='GLB',export_extras=True,export_apply=True)
print('Transformer model exported')
