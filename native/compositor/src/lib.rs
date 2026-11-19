//! Prototype browser-only compositor. No filesystem, network or model calls.
//! Import reports are preserved; successful parsing never certifies fidelity.
use std::{collections::BTreeMap, sync::{Arc,Mutex}};
use wasm_bindgen::prelude::*;
use effectcraft_project::{Project, ItemId, LayerId, Footage, Layer, Property, Node, PropGroup, Value};
use effectcraft_render::{FootageSource, Image, Renderer, RenderOpts, ExprHost, EvalCtx};
use effectcraft_time::Tick;
use effectcraft_aep::import::{ImportOptions, import, analyze_with};

fn err(e: impl std::fmt::Display) -> JsValue { JsValue::from_str(&e.to_string()) }

#[derive(Default)]
struct CheckedExpressions(Mutex<Vec<String>>);
impl CheckedExpressions {
    fn record<T>(&self, result:Result<T,String>, layer:&Layer, prop:&Property)->Result<T,String> {
        if let Err(message)=&result { if let Ok(mut errors)=self.0.lock() { if errors.len()<12 { errors.push(format!("Layer {}, property {}: {}",layer.id.0,prop.uid,message.chars().take(240).collect::<String>())); } } }
        result
    }
}
impl ExprHost for CheckedExpressions {
    fn eval(&self,ctx:&EvalCtx,layer:&Layer,prop:&Property,value:&Value)->Result<Value,String> {
        let result=match &prop.expr { Some(e)=>effectcraft_expr::evaluate(self,ctx,layer,prop,value,&e.text),None=>Ok(value.clone()) };
        self.record(result,layer,prop)
    }
    fn eval_text_selector(&self,ctx:&EvalCtx,layer:&Layer,prop:&Property,index:usize,total:usize,selector:[f64;3])->Result<[f64;3],String> {
        self.record(effectcraft_expr::Expressions.eval_text_selector(ctx,layer,prop,index,total,selector),layer,prop)
    }
}

fn replace_font(group: &mut PropGroup, original: &str, replacement: &str) -> usize {
    let mut changed=0;
    for child in &mut group.children {
        match child {
            Node::Group(g) => changed+=replace_font(g,original,replacement),
            Node::Prop(p) => {
                for value in std::iter::once(&mut p.value).chain(p.keys.iter_mut().map(|k|&mut k.value)) {
                    if let Value::Text(doc)=value {
                        if doc.font==original { doc.font=replacement.into(); changed+=1; }
                        doc.apply_style_all(|style| if style.font==original { style.font=replacement.into(); });
                    }
                }
            }
        }
    }
    changed
}

#[derive(Default)]
struct Pictures(BTreeMap<String, Arc<Image>>);
impl FootageSource for Pictures {
    fn frame(&self, _: ItemId, footage: &Footage, _: Tick) -> Option<Arc<Image>> {
        self.0.get(&footage.path).cloned()
    }
}

#[wasm_bindgen]
pub struct NativeCompositor {
    project: Project,
    pictures: Pictures,
    report: String,
}

#[wasm_bindgen]
impl NativeCompositor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { Self { project: Project::default(), pictures: Pictures::default(), report: "{}".into() } }

    pub fn add_font(&mut self, bytes: &[u8]) -> Result<usize, JsValue> {
        if bytes.len() > 32_000_000 { return Err(err("Font exceeds limit")); }
        let count=effectcraft_text::fonts::add_font_data(bytes.to_vec()).len();
        if count==0 { return Err(err("Font has no readable faces")); }
        Ok(count)
    }

    pub fn put_picture(&mut self, path: String, width: u32, height: u32, rgba: &[u8]) -> Result<(),JsValue> {
        let pixels=u64::from(width)*u64::from(height);
        if width==0 || height==0 || pixels>16_000_000 || rgba.len() as u64 != pixels*4 || path.len()>4096 { return Err(err("Invalid picture")); }
        let data=rgba.chunks_exact(4).map(|p| { let a=f32::from(p[3])/255.;[f32::from(p[0])/255.*a,f32::from(p[1])/255.*a,f32::from(p[2])/255.*a,a] }).collect();
        self.pictures.0.insert(path,Arc::new(Image{width,height,data}));
        Ok(())
    }

    pub fn inspect_aep(&self, bytes: &[u8]) -> Result<String,JsValue> {
        if bytes.len()>32_000_000 { return Err(err("Template exceeds limit")); }
        let exists=|p:&str|self.pictures.0.contains_key(p);
        let font=|name:&str|!effectcraft_text::resolve(name,"Regular").missing;
        let options=ImportOptions{has_font:&font,..ImportOptions::new(&exists)};
        serde_json::to_string(&analyze_with(bytes,&options).map_err(err)?).map_err(err)
    }

    pub fn load_aep(&mut self, bytes: &[u8], diagnostic: bool) -> Result<String,JsValue> {
        if bytes.len()>32_000_000 { return Err(err("Template exceeds limit")); }
        let exists=|p:&str|self.pictures.0.contains_key(p);
        let font=|name:&str|!effectcraft_text::resolve(name,"Regular").missing;
        let options=ImportOptions{allow_losses:diagnostic,has_font:&font,..ImportOptions::new(&exists)};
        let mut project=Project::default();
        let result=import(&mut project,bytes,&options).map_err(err)?;
        if !diagnostic && (!result.report.missing_fonts.is_empty() || !result.report.missing_footage.is_empty()) { return Err(err("Template has unresolved font or picture dependencies")); }
        project.settings=result.settings;
        self.report=serde_json::to_string(&result.report).map_err(err)?;
        self.project=project;
        Ok(self.report.clone())
    }

    pub fn project_json(&self) -> Result<String,JsValue> { serde_json::to_string(&self.project).map_err(err) }

    pub fn load_project(&mut self, json: &str) -> Result<(),JsValue> {
        if json.len()>16_000_000 { return Err(err("Project exceeds limit")); }
        let (project,repairs)=Project::from_json_repaired(json).map_err(err)?;
        if !repairs.is_empty() || project.items.len()>2048 || project.comps().map(|(_,c)|c.layers.len()).sum::<usize>()>4096 { return Err(err("Project needs repair or exceeds supported complexity")); }
        self.project=project;
        Ok(())
    }

    pub fn apply_font_alias(&mut self, original: &str, replacement: &str) -> Result<usize,JsValue> {
        if original.len()>200 || replacement.len()>200 || effectcraft_text::resolve(replacement,"Regular").missing { return Err(err("Replacement font is unavailable")); }
        let ids:Vec<_>=self.project.comps().map(|(id,_)|*id).collect();
        let mut count=0;
        for id in ids { if let Some(comp)=self.project.comp_mut(id) { for layer in comp.layers.iter_mut() { count+=replace_font(&mut layer.props,original,replacement); } } }
        Ok(count)
    }

    pub fn set_text(&mut self, comp_id:u32, layer_id:u32, prop_id:u32, text:&str) -> Result<(),JsValue> {
        if text.chars().count()>2000 || text.chars().any(|c|c.is_control() && c!='\n' && c!='\r' && c!='\t') { return Err(err("Invalid template text")); }
        let property=self.project.comp_mut(ItemId(u64::from(comp_id))).and_then(|c|c.layer_mut(LayerId(u64::from(layer_id)))).and_then(|l|l.props.find_mut(u64::from(prop_id))).ok_or_else(||err("Unknown text control"))?;
        if !matches!(property.value,Value::Text(_)) || property.keys.iter().any(|k|!matches!(k.value,Value::Text(_))) { return Err(err("Control is not text")); }
        if property.has_expression() { return Err(err("This text is expression-driven; edit its exposed source control")); }
        for value in std::iter::once(&mut property.value).chain(property.keys.iter_mut().map(|k|&mut k.value)) { if let Value::Text(doc)=value { doc.set_text(text); } }
        Ok(())
    }

    pub fn set_control(&mut self, comp_id:u32, layer_id:u32, prop_id:u32, value_json:&str) -> Result<(),JsValue> {
        if value_json.len()>4096 { return Err(err("Control value exceeds limit")); }
        let value:Value=serde_json::from_str(value_json).map_err(err)?;
        let property=self.project.comp_mut(ItemId(u64::from(comp_id))).and_then(|c|c.layer_mut(LayerId(u64::from(layer_id)))).and_then(|l|l.props.find_mut(u64::from(prop_id))).ok_or_else(||err("Unknown template control"))?;
        if property.has_expression() || !property.keys.is_empty() { return Err(err("Edit this animated control through its authored source")); }
        let safe=match (&property.value,&value) {
            (Value::Scalar(_),Value::Scalar(n))=>n.is_finite()&&n.abs()<=1_000_000.,
            (Value::Color(_),Value::Color(c))=>c.iter().all(|x|x.is_finite()&&*x>=0.&&*x<=1.),
            (Value::Vec2(_),Value::Vec2(v))=>v.iter().all(|x|x.is_finite()&&x.abs()<=1_000_000.),
            (Value::Vec3(_),Value::Vec3(v))=>v.iter().all(|x|x.is_finite()&&x.abs()<=1_000_000.),
            (Value::Bool(_),Value::Bool(_))=>true,
            _=>false,
        };
        if !safe { return Err(err("Template control type or value is invalid")); }
        property.value=value;
        Ok(())
    }

    /// Fit replacement copy inside the authored text span using the renderer's
    /// actual glyph layout. Never use string length to guess text dimensions.
    pub fn set_fitted_text(&mut self, comp_id:u32, layer_id:u32, prop_id:u32, text:&str) -> Result<f64,JsValue> {
        let property=self.project.comp(ItemId(u64::from(comp_id))).and_then(|c|c.layer(LayerId(u64::from(layer_id)))).and_then(|l|l.props.find(u64::from(prop_id))).ok_or_else(||err("Unknown text control"))?;
        let original=match &property.value {Value::Text(doc)=>effectcraft_text::layout_doc(doc).bounds,_=>return Err(err("Control is not text"))};
        self.set_text(comp_id,layer_id,prop_id,text)?;
        let property=self.project.comp_mut(ItemId(u64::from(comp_id))).and_then(|c|c.layer_mut(LayerId(u64::from(layer_id)))).and_then(|l|l.props.find_mut(u64::from(prop_id))).ok_or_else(||err("Unknown text control"))?;
        let doc=match &mut property.value {Value::Text(doc)=>doc,_=>return Err(err("Control is not text"))};
        let layout=effectcraft_text::layout_doc(doc);
        if layout.layout.missing_font || layout.layout.glyphs.iter().any(|g| g.id==0 && text.get(g.cluster..).and_then(|s|s.chars().next()).is_some_and(|c|!c.is_whitespace())) {return Err(err("The template font does not contain these characters. Choose a different text style."));}
        let ratio=((original[2]-original[0]).max(1.)/(layout.bounds[2]-layout.bounds[0]).max(1.)).min(((original[3]-original[1]).max(1.)/(layout.bounds[3]-layout.bounds[1]).max(1.)).min(1.));
        if ratio<0.2 {return Err(err("The title is too long for this animation. Shorten the copy or choose a plain text style."));}
        if ratio<1. {doc.apply_style_all(|style| {style.size*=ratio;style.stroke_width*=ratio;});}
        Ok(ratio)
    }

    /// Keep separately authored halves of a word at the same fitted font size.
    pub fn scale_text(&mut self, comp_id:u32, layer_id:u32, prop_id:u32, scale:f64) -> Result<(),JsValue> {
        if !scale.is_finite() || !(0.2..=1.).contains(&scale) { return Err(err("Invalid text fit scale")); }
        let property=self.project.comp_mut(ItemId(u64::from(comp_id))).and_then(|c|c.layer_mut(LayerId(u64::from(layer_id)))).and_then(|l|l.props.find_mut(u64::from(prop_id))).ok_or_else(||err("Unknown text control"))?;
        if property.has_expression() || !property.keys.is_empty() { return Err(err("Animated text cannot be fitted this way")); }
        match &mut property.value {
            Value::Text(doc)=>{doc.apply_style_all(|style| {style.size*=scale;style.stroke_width*=scale;});Ok(())},
            _=>Err(err("Control is not text"))
        }
    }

    pub fn render(&self, comp_id: u32, time: f64, scale: f64) -> Result<Vec<u8>,JsValue> {
        if !time.is_finite() || time<0. || !scale.is_finite() || scale<=0. || scale>2. { return Err(err("Invalid render clock or scale")); }
        let comp=self.project.comp(ItemId(u64::from(comp_id))).ok_or_else(||err("Unknown composition"))?;
        if (f64::from(comp.width)*scale).ceil()*(f64::from(comp.height)*scale).ceil()>8_300_000. { return Err(err("Render exceeds pixel limit")); }
        let mut renderer=Renderer::new(&self.project,&self.pictures,RenderOpts{scale,..Default::default()});
        let expressions=CheckedExpressions::default();
        renderer.expr=Some(&expressions);
        let image=renderer.comp_frame(ItemId(u64::from(comp_id)),Tick::from_seconds_f64(time));
        let errors=expressions.0.lock().map_err(|_|err("Expression diagnostics unavailable"))?;
        if !errors.is_empty() { return Err(err(format!("Template expression failed: {}",errors.join("; ")))); }
        // Canvas ImageData expects straight alpha, while the compositor is premultiplied.
        let mut rgba=Vec::with_capacity(image.data.len()*4);
        for px in image.data { let a=px[3].clamp(0.,1.); for c in px.iter().take(3) { rgba.push(if a>0. { (c/a).clamp(0.,1.).mul_add(255.,0.5) as u8 } else { 0 }); } rgba.push((a*255.+0.5) as u8); }
        Ok(rgba)
    }
}
