/* חידת הנוגדנים בתוך החלל: הדגמה בכלי הדם, זימון, שתי תגובות, מקרה נוסף וחיזוי. */
window.initPuzzle = function (G, root) {
  'use strict';
  var THREE = window.THREE, V = G.V, player = G.player;

  // כל הניסוחים שעל המסך. הצעה לאישור ירדן.
  var T = { nextCase: 'מקרה נוסף', retry: 'לנסות שוב', again: 'לשחק שוב' };

  // ---------- חשבון בצירי Blender (Z למעלה), כמו ב־build_scene.py ----------
  var AB_H = 1.2535;
  var C = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1), Ci = C.clone().invert();
  function pose(M) {
    var m = C.clone().multiply(M).multiply(Ci), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(p, q, s); return { p: p, q: q };
  }
  function Tm(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }
  function rot(fx, fy, tilt) {
    return new THREE.Matrix4().makeRotationZ(Math.atan2(-fx, fy)).multiply(new THREE.Matrix4().makeRotationY(tilt * Math.PI / 180));
  }
  // נוגדן שנקשר: שתי הזרועות אוחזות ברעלן. slip: רק מתחיל להיקשר, בזרוע אחת
  function boundPose(tox, fx, fy, tilt, slip) {
    slip = slip || 0;
    var R = rot(fx, fy, tilt), off = new THREE.Vector3(slip, 0, AB_H + 0.12 + Math.abs(slip) * 0.3).applyMatrix4(R);
    return pose(Tm(tox[0] - off.x, tox[1] - off.y, tox[2] - off.z).multiply(R));
  }
  function freePose(p, fx, fy, tilt) { return pose(Tm(p[0], p[1], p[2]).multiply(rot(fx, fy, tilt))); }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function clamp01(k) { return Math.max(0, Math.min(1, k)); }

  var TOX = G.TOX, CELL = G.CELL, PED = G.PED;
  var d3 = [CELL[0] - TOX[0], CELL[1] - TOX[1], CELL[2] - TOX[2]], L = Math.sqrt(d3[0] * d3[0] + d3[1] * d3[1] + d3[2] * d3[2]);
  var TO_CELL = [d3[0] / L, d3[1] / L, d3[2] / L];
  var l2 = Math.sqrt(TO_CELL[0] * TO_CELL[0] + TO_CELL[1] * TO_CELL[1]), U2 = [TO_CELL[0] / l2, TO_CELL[1] / l2], SIDE = [-U2[1], U2[0]];
  var TOX2 = [TOX[0] + TO_CELL[0] * 3.4, TOX[1] + TO_CELL[1] * 3.4, TOX[2] + TO_CELL[2] * 3.4];   // כמעט נוגע בתא הגוף
  var MID = [TOX[0] * 0.6 + CELL[0] * 0.4, TOX[1] * 0.6 + CELL[1] * 0.4];
  var CAM5 = [MID[0] + SIDE[0] * 5.2 + U2[0] * 1.1, MID[1] + SIDE[1] * 5.2 + U2[1] * 1.1];
  var POSE_BOUND = boundPose(TOX, CAM5[0] - TOX[0], CAM5[1] - TOX[1], 100);
  var POSE_PASS = freePose([TOX2[0] - U2[0] * 1.5, TOX2[1] - U2[1] * 1.5, TOX2[2] + 1.25], CAM5[0] - TOX2[0], CAM5[1] - TOX2[1], -62);
  var MATCH = { 1: 'a', 2: 'b' };                      // מי נקשר לרעלן בכל מקרה (a = ריבוע חלול, b = מלא)
  var DEMO_X = -12.5;

  // ---------- רעלנים ----------
  var DEAD = new THREE.Color(0xd2ccd4), DEAD_E = new THREE.Color(0x2a282c);
  function makeToxin(src, withTrail) {
    var o = src.clone(); o.material = src.material.clone(); o.visible = false; root.add(o);
    var t = { obj: o, mat: o.material, liveC: o.material.color.clone(), liveE: o.material.emissive.clone(), liveI: o.material.emissiveIntensity,
      base: [0, 0, 0], pos: [0, 0, 0], dead: 0, spin: Math.random() * 6, trail: null };
    if (withTrail) {
      var n = 9, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      t.trail = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff5aa0, size: 0.11, map: G.dot(), alphaTest: 0.2, transparent: true, opacity: 0.9 }));
      t.trail.frustumCulled = false; root.add(t.trail);
    }
    return t;
  }
  function drawToxin(t, time, dt, dir) {
    var k = t.dead;
    t.mat.color.copy(t.liveC).lerp(DEAD, k); t.mat.emissive.copy(t.liveE).lerp(DEAD_E, k); t.mat.emissiveIntensity = t.liveI * (1 - k) + 0.25 * k;
    t.spin += dt * 0.5 * (1 - k);
    t.obj.rotation.y = t.spin;
    var bob = Math.sin(time * 1.3 + t.base[0]) * 0.07 * (1 - k);
    t.obj.position.copy(V(t.pos[0], t.pos[1], t.pos[2] + bob));
    if (t.trail) {
      t.trail.visible = t.obj.visible && k < 0.5;
      var a = t.trail.geometry.attributes.position, n = a.count;
      for (var i = 0; i < n; i++) {
        var f = (time * 0.35 + i / n) % 1, d = 0.55 + f * 2.6, w = Math.sin(i * 12.9 + time) * 0.1;
        var p = V(t.pos[0] - dir[0] * d + w, t.pos[1] - dir[1] * d - w, t.pos[2] - dir[2] * d + Math.cos(i * 7.3) * 0.1);
        a.setXYZ(i, p.x, p.y, p.z);
      }
      a.needsUpdate = true;
    }
  }
  var srcTox = { a: root.getObjectByName('toxin_a'), b: root.getObjectByName('toxin_b') };
  srcTox.a.visible = false; srcTox.b.visible = false;
  var mainTox = { 1: makeToxin(srcTox.a, true), 2: makeToxin(srcTox.b, true) };
  var demoTox = { 1: [makeToxin(srcTox.a), makeToxin(srcTox.a, true)], 2: [makeToxin(srcTox.b), makeToxin(srcTox.b, true)] };

  // ---------- נוגדנים ----------
  var SIG_OFF = new THREE.Color(0xc8c8c8), SIG_ON = new THREE.Color(0xb4eb1e);
  var abs = {};
  ['a', 'b'].forEach(function (k) {
    var o = root.getObjectByName('antibody_' + k), sig = root.getObjectByName('signal_' + k);
    sig.material = sig.material.clone();
    var light = new THREE.PointLight(0x9be01e, 0, 4, 1.6); light.position.copy(sig.getWorldPosition(new THREE.Vector3())); light.position.y += 0.25; root.add(light);
    var hit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(o.position); hit.position.y += 0.65; hit.userData.kind = k; root.add(hit);
    abs[k] = { kind: k, obj: o, rest: { p: o.position.clone(), q: o.quaternion.clone() }, sig: sig, light: light, hit: hit, home: true, phase: Math.random() * 6 };
  });
  function setSignal(k, on) { abs[k].sig.material.color.copy(on ? SIG_ON : SIG_OFF); abs[k].light.intensity = on ? 1.6 : 0; }
  function demoAntibody(k) { var o = abs[k].obj.clone(true); o.visible = false; root.add(o); return o; }
  var demoAb = { a: [demoAntibody('a'), demoAntibody('a')], b: [demoAntibody('b'), demoAntibody('b')] };   // [נקשר, חולף]

  // טבעת עדינה מעל נוגדן שאפשר לזמן
  function ringTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
    g.strokeStyle = '#8AB21A'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 24, 0, 6.3); g.stroke();
    g.fillStyle = '#8AB21A'; g.beginPath(); g.arc(32, 32, 7, 0, 6.3); g.fill();
    return new THREE.CanvasTexture(c);
  }
  var ringMat = new THREE.SpriteMaterial({ map: ringTexture(), depthTest: false, transparent: true });
  var rings = ['a', 'b'].map(function (k) {
    var s = new THREE.Sprite(ringMat); s.position.copy(abs[k].rest.p); s.position.y += 1.45; s.renderOrder = 5; s.visible = false; root.add(s); return s;
  });

  // ---------- תנועות ----------
  var tweens = [];
  function tween(dur, fn, done) { tweens.push({ t: 0, dur: dur, fn: fn, done: done }); }
  function fly(ab, to, dur, lift, done) {
    var p0 = ab.obj.position.clone(), q0 = ab.obj.quaternion.clone(); ab.home = false;
    tween(dur, function (k) {
      var e = ease(k);
      ab.obj.position.lerpVectors(p0, to.p, e); ab.obj.position.y += Math.sin(e * Math.PI) * lift;
      ab.obj.quaternion.slerpQuaternions(q0, to.q, e);
    }, done);
  }

  // ---------- מצב ----------
  var caseNo = 1, phase = 'idle', picked = null, prediction = null, advance = 0, hurt = 0;
  var CELL_LIVE = G.cellMat.color.clone(), CELL_HURT = new THREE.Color(0x4a3a44), CELL_GLOW = G.cellMat.emissiveIntensity;
  // אור עדין שפועם בפתח של כלי הדם, כדי למשוך אליו את המבט בלי מילים
  var beacon = G.lamp(-10.4, 0, 2.1, 0xffe9d2, 0, 10);
  var layer = document.getElementById('layer');
  function bar() { layer.innerHTML = ''; var d = document.createElement('div'); d.className = 'bar'; layer.appendChild(d); return d; }
  // על המסך מופיעים סמלים. המילים נשארות רק כתווית נגישות (aria-label) ובמסך הסיום.
  var SVG = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">';
  var ICON = {
    next: SVG + '<path d="M25 8L12 20l13 12"/></svg>',
    retry: SVG + '<path d="M31 20a11 11 0 1 1-3.5-8"/><path d="M32 6v8h-8"/></svg>'
  };
  function pill(parent, text, cls, go, icon) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pill' + (cls ? ' ' + cls : '');
    if (icon) { b.innerHTML = ICON[icon]; b.className += ' icon'; b.setAttribute('aria-label', text); b.title = text; } else { b.textContent = text; }
    b.addEventListener('click', go); parent.appendChild(b); return b;
  }

  function reset() {
    tweens = []; phase = 'idle'; picked = null; prediction = null; advance = 0; hurt = 0; layer.innerHTML = '';
    ['a', 'b'].forEach(function (k) {
      var ab = abs[k]; ab.obj.position.copy(ab.rest.p); ab.obj.quaternion.copy(ab.rest.q); ab.home = true; setSignal(k, false);
    });
    [1, 2].forEach(function (n) {
      mainTox[n].obj.visible = (n === caseNo); mainTox[n].dead = 0;
      demoTox[n].forEach(function (t) { t.obj.visible = (n === caseNo); });
    });
    var bind = MATCH[caseNo], other = bind === 'a' ? 'b' : 'a';
    ['a', 'b'].forEach(function (k) { demoAb[k][0].visible = (k === bind); demoAb[k][1].visible = (k === other); });
  }
  function setCase(n) {
    caseNo = n; reset();          // בלי כיתוב: המטרה נמסרת בסרטון וברגע הפתיחה, והרעלן האחר נראה בעולם
    if (n === 1) { startIntro(); }
  }

  // אחרי ההרצה: מה מוצג, ומה אפשר לעשות
  function after(matched) {
    var b = bar();
    // הציפייה שסומנה נשארת בחלל, מעל המקום שנבחר
    if (!matched) { pill(b, T.retry, '', reset, 'retry'); }   // לא מגלים מי כן מתאים
    else if (caseNo === 1) { pill(b, T.nextCase, '', function () { setCase(2); }, 'next'); }
    else { pill(b, T.again, '', function () { G.home(); setCase(1); }, 'retry'); }
  }
  // התגובה הלימודית: מה קורה לרעלן
  function run() {
    var ab = abs[picked], matched = (picked === MATCH[caseNo]), tox = mainTox[caseNo];
    phase = 'running'; layer.innerHTML = '';
    if (matched) {
      fly(ab, POSE_BOUND, 2.6, 0.5, function () {
        tween(1.1, function (k) { tox.dead = k; }, function () { phase = 'done'; after(true); });
      });
    } else {
      fly(ab, POSE_PASS, 3.0, 0.2, null);
      // הרעלן מגיע אל תא הגוף, והתא נפגע: כך רואים מה היה על הכף
      tween(3.6, function (k) { advance = ease(k); }, function () {
        tween(1.0, function (k) { hurt = k; }, function () { phase = 'done'; after(false); });
      });
    }
  }
  // התגובה המשחקית: האות של הנוגדן נדלק, והוא יוצא מהשקע
  function summon(k) {
    if (phase !== 'idle') { return false; }
    picked = k; phase = 'summoned'; setSignal(k, true);
    document.getElementById('hint').classList.add('off');
    var ab = abs[k], up = { p: ab.rest.p.clone(), q: ab.rest.q.clone() }; up.p.y += 0.55;
    fly(ab, up, 0.8, 0, function () {
      if (caseNo === 1) { run(); return; }
      phase = 'predict';             // הנוגדן ממתין, ושתי הדמויות של הרעלן מופיעות בחלל
    });
    return true;
  }
  // החיזוי מסומן בתוך העולם: לוחצים על המקום שבו מצפים לראות את הרעלן, ורק אז הנוגדן יוצא
  function predict(v) {
    if (phase !== 'predict') { return false; }
    prediction = v;
    var g = ghosts[v], p0 = g.obj.position.clone(), s0 = g.obj.scale.x;
    tween(0.6, function (k) { var e = ease(k); g.obj.position.copy(p0); g.obj.position.y += e * 1.15; g.obj.scale.setScalar(s0 * (1 - 0.45 * e)); }, null);
    run();
    return true;
  }

  function inReach() { var dx = player.x - PED[0], dy = player.y - PED[1]; return dx * dx + dy * dy < 5.2 * 5.2; }

  // ---------- לחיצה: נגיעה קצרה בלי גרירה ----------
  var ray = new THREE.Raycaster(), down = null;
  G.canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
  G.canvas.addEventListener('pointerup', function (e) {
    if (!down || down.id !== e.pointerId) { return; }
    var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y), quick = performance.now() - down.t < 500; down = null;
    if (moved > 10 || !quick) { return; }
    ray.setFromCamera(new THREE.Vector2(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), G.camera);
    var hits;
    if (phase === 'idle' && inReach()) {
      hits = ray.intersectObjects([abs.a.hit, abs.b.hit], false);
      if (hits.length) { summon(hits[0].object.userData.kind); }
    } else if (phase === 'predict') {
      hits = ray.intersectObjects([ghosts.yes.hit, ghosts.no.hit], false);
      if (hits.length) { predict(hits[0].object.userData.v); }
    }
  });

  // ---------- שתי הדמויות של החיזוי: רעלן חיוור שנעצר בדרך, ורעלן ורוד שהגיע אל תא הגוף ----------
  var GHOST_AT = { yes: [TOX[0] + TO_CELL[0] * 1.1, TOX[1] + TO_CELL[1] * 1.1, TOX[2] + TO_CELL[2] * 1.1], no: TOX2 };
  var ghosts = {};
  ['yes', 'no'].forEach(function (v) {
    var o = srcTox.b.clone();
    o.material = new THREE.MeshBasicMaterial({ color: v === 'yes' ? 0xe6e0e8 : 0xff5aa0, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false });
    o.castShadow = false; o.visible = false; o.renderOrder = 4; root.add(o);
    var hit = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(V(GHOST_AT[v][0], GHOST_AT[v][1], GHOST_AT[v][2])); hit.userData.v = v; root.add(hit);
    var ring = new THREE.Sprite(ringMat); ring.position.copy(hit.position); ring.position.y += 1.0; ring.renderOrder = 5; ring.visible = false; root.add(ring);
    ghosts[v] = { obj: o, hit: hit, ring: ring, s: o.scale.x };
  });
  function drawGhosts(time) {
    ['yes', 'no'].forEach(function (v) {
      var g = ghosts[v], open = (phase === 'predict'), kept = (prediction === v && (phase === 'running' || phase === 'done'));
      g.obj.visible = (caseNo === 2) && (open || kept); g.ring.visible = open;
      if (open) {
        g.obj.position.copy(g.hit.position); g.obj.scale.setScalar(g.s * (1 + Math.sin(time * 2.4 + (v === 'yes' ? 0 : 2)) * 0.06));
        g.obj.rotation.y = time * 0.4; g.ring.scale.set(0.5, 0.5, 1);
      }
    });
  }

  // ---------- זוהר סביב הרעלן הפעיל ----------
  function glowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,60,140,.28)'); r.addColorStop(0.45, 'rgba(255,60,140,.12)'); r.addColorStop(1, 'rgba(255,60,140,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  root.add(halo);

  // ---------- רגע הפתיחה: רעלן קטן מגיע אל תא קטן, והתא נפגע. כך רואים מה מאיים, בלי מילים ----------
  var VIC = [5.5, 2.3, 0]; VIC[2] = G.floorZ(VIC[0], VIC[1]) + 0.6;
  var VIC_FROM = [8.3, 3.0, 2.5];
  var victim = root.getObjectByName('cell').clone(); victim.material = G.cellMat.clone(); victim.renderOrder = 2; root.add(victim);
  var vicS = victim.scale.x * 0.42, vicLive = victim.material.color.clone();
  victim.position.copy(V(VIC[0], VIC[1], VIC[2]));
  var introTox = makeToxin(srcTox.a, true), introS = introTox.obj.scale.x * 0.55, introT = -1;
  var vd = [VIC[0] - VIC_FROM[0], VIC[1] - VIC_FROM[1], VIC[2] - VIC_FROM[2]], vl = Math.sqrt(vd[0] * vd[0] + vd[1] * vd[1] + vd[2] * vd[2]);
  var VDIR = [vd[0] / vl, vd[1] / vl, vd[2] / vl];
  G.block.push([VIC[0], VIC[1], 0.9]);
  function startIntro() { introT = 0; }
  function drawIntro(dt, time) {
    if (introT < 0) { return; }
    introT += dt;
    var go = ease(clamp01((introT - 1.2) / 2.6)), stop = 0.62;              // נעצר על קרום התא
    var d = (vl - stop) * go;
    introTox.pos = [VIC_FROM[0] + VDIR[0] * d, VIC_FROM[1] + VDIR[1] * d, VIC_FROM[2] + VDIR[2] * d];
    var hit = clamp01((introT - 3.8) / 1.4), fade = clamp01((introT - 6.5) / 1.2);
    introTox.obj.visible = fade < 1; introTox.obj.scale.setScalar(introS * (1 - fade));
    drawToxin(introTox, time, dt, VDIR);
    if (introTox.trail) { introTox.trail.visible = introTox.obj.visible && go < 1; }
    victim.material.color.copy(vicLive).lerp(CELL_HURT, hit); victim.material.emissiveIntensity = CELL_GLOW * (1 - hit);
    victim.scale.setScalar(vicS * (1 - 0.2 * hit) * (1 + Math.sin(time * 9) * 0.03 * hit * (1 - hit) * 4));
  }

  // ---------- ההדגמה בכלי הדם: נראית מהצד, דרך הפתח ----------
  var PERIOD = 9;
  function demo(time) {
    var tt = time % PERIOD, bind = MATCH[caseNo], other = bind === 'a' ? 'b' : 'a';
    var partial = (caseNo === 2);                                  // במקרה הנוסף רואים רק מי מתחיל להיקשר
    var tox1 = demoTox[caseNo][0], tox2 = demoTox[caseNo][1], ab1 = demoAb[bind][0], ab2 = demoAb[other][1];
    var arrive = clamp01(tt / 3.2), e = ease(arrive);
    var ty = (partial ? -1.0 : -1.75);
    var target = boundPose([DEMO_X, ty, 2.05], 1, 0, -100, partial ? 0.32 : 0);
    var start = target.p.clone().add(V(0, -3.4, 0.5).sub(V(0, 0, 0)));
    ab1.position.lerpVectors(start, target.p, e); ab1.quaternion.copy(target.q);
    tox1.pos = [DEMO_X, ty - 0.5 * (1 - e), 2.05];
    tox1.dead = partial ? 0 : clamp01((tt - 3.2) / 0.9);
    // הנוגדן האחר חולף, והרעלן שלידו ממשיך
    var f = tt / PERIOD;
    tox2.pos = [DEMO_X, 0.5 + f * 1.2, 1.75];
    var pp = freePose([DEMO_X - 0.3, -0.6 + f * 3.6, 2.2 - f * 0.3], 1, 0, 38);
    ab2.position.copy(pp.p); ab2.quaternion.copy(pp.q);
    // כניסה ויציאה רכות בין סיבוב לסיבוב
    var s = Math.min(clamp01(tt / 0.5), clamp01((PERIOD - tt) / 0.5)); s = Math.max(0.001, ease(s));
    ab1.scale.setScalar(s); ab2.scale.setScalar(s); tox1.obj.scale.setScalar(s); tox2.obj.scale.setScalar(s);
  }

  // ---------- בכל תמונה ----------
  var sway = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0);
  G.alive.push(function (dt, time) {
    var i;
    for (i = tweens.length - 1; i >= 0; i--) {
      var w = tweens[i]; w.t += dt; var k = clamp01(w.t / w.dur); w.fn(k);
      if (k >= 1) { tweens.splice(i, 1); if (w.done) { w.done(); } }
    }
    // הרעלן שבאזור הפצע: נע קלות על המסלול אל התא, ומתקדם באמת רק אחרי זימון שלא ניטרל אותו
    var tox = mainTox[caseNo], drift = (phase === 'idle' || phase === 'predict' || phase === 'summoned') ? Math.sin(time * 0.5) * 0.3 : 0;
    var a = advance, bx = TOX[0] + (TOX2[0] - TOX[0]) * a, by = TOX[1] + (TOX2[1] - TOX[1]) * a, bz = TOX[2] + (TOX2[2] - TOX[2]) * a;
    tox.pos = [bx + TO_CELL[0] * drift * (1 - tox.dead), by + TO_CELL[1] * drift * (1 - tox.dead), bz];
    if (picked === MATCH[caseNo] && phase === 'running') { tox.pos = [TOX[0], TOX[1], TOX[2]]; }
    drawToxin(tox, time, dt, TO_CELL);
    G.toxGlow.position.copy(tox.obj.position); G.toxGlow.intensity = (0.85 + Math.sin(time * 2.6) * 0.2) * (1 - tox.dead);
    halo.position.copy(tox.obj.position); halo.material.opacity = 1 - tox.dead; halo.scale.setScalar(2.6 + Math.sin(time * 2.6) * 0.25);
    drawGhosts(time); drawIntro(dt, time);
    demo(time);
    demoTox[caseNo].forEach(function (t) { drawToxin(t, time, dt, [0, 1, 0.1]); });
    // נוגדן שממתין בשקע זז מעט
    ['a', 'b'].forEach(function (k2) {
      var ab = abs[k2];
      if (ab.home) { sway.setFromAxisAngle(AX, Math.sin(time * 0.9 + ab.phase) * 0.035); ab.obj.quaternion.copy(ab.rest.q).multiply(sway); }
    });
    G.cellMat.color.copy(CELL_LIVE).lerp(CELL_HURT, hurt); G.cellMat.emissiveIntensity = CELL_GLOW * (1 - hurt);
    beacon.intensity = 0.9 + Math.sin(time * 1.8) * 0.6;
    // הטבעות נראות גם מרחוק, חלשות; ליד העמדה הן מתחזקות, ורק אז אפשר לזמן
    var near = inReach(), pulse = (near ? 0.42 : 0.5) + Math.sin(time * 3) * 0.04;
    ringMat.opacity = near ? 1 : 0.45;
    rings.forEach(function (r) { r.visible = (phase === 'idle'); r.scale.set(pulse, pulse, 1); });
  });

  setCase(1);
  // לבדיקות ולהדגמה
  window.__pz = {
    state: function () { return { caseNo: caseNo, phase: phase, picked: picked, prediction: prediction, reach: inReach(), dead: +mainTox[caseNo].dead.toFixed(2), advance: +advance.toFixed(2), ui: Array.prototype.map.call(layer.querySelectorAll('button, .q, .mark, p'), function (e) { return e.getAttribute('aria-label') || e.textContent; }), hurt: +hurt.toFixed(2) }; },
    summon: summon, setCase: setCase, predict: predict, intro: function () { return +introT.toFixed(1); }
  };
};
