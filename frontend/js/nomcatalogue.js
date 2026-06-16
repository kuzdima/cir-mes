// ============================================================
// nomcatalogue.js — Каталог поиска по базе архива изделий
// 
// ============================================================


var catArcDB = []; // локальный кэш архива

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────
function initCat() {
  catLoadFromDB();



}

// ── ЗАГРУЗКА АРХИВА ИЗ БД ─────────────────────────────────
function catLoadFromDB() {
  if (!TOKEN) { setTimeout(catLoadFromDB, 500); return; }
  api('GET', '/api/archive').then(function (res) {
    if (res.ok && res.rows) {
      catArcDB = res.rows;
      catRenderArchive();
      var countEl = document.getElementById('cat-db-count');
      if (countEl) countEl.textContent = catArcDB.length;
      CatFilterArchive(document.getElementById("cat-search").value);
      prepareProductCatalogue();
    }
  });
}



function catRenderArchive(filter, id) {
  var tbody = document.getElementById('arc-catalogue-tbody');
  if (!tbody) return;

  var rows = catArcDB;
  
  // Если передали Id изделия - фильтруем его и его прямых потомков(без потомков потомков)
  if (id) {
    let parent = rows.find((e) => { return e.id === id });
    if (parent) {
      rows = findCildren(parent, rows);
      rows.push(parent);
    }
  }

  if (filter) {
    var q = filter.toLowerCase();
    // Если ищут конкретный Assembly_ID — показываем всю структуру
    var exactMatch = rows.filter(function (r) {
      return (r.assembly_id || '').toLowerCase() === q
        || (r.classifier || '').toLowerCase() === q;
    });
    if (exactMatch.length > 0) {
      var aid = exactMatch[0].assembly_id;
      rows = rows.filter(function (r) { return r.assembly_id === aid; });
    } else {
      rows = rows.filter(function (r) {
        return (r.assembly_id || '').toLowerCase().indexOf(q) !== -1
          || (r.item_name || r.name || '').toLowerCase().indexOf(q) !== -1
          || (r.classifier || '').toLowerCase().indexOf(q) !== -1;
      });
    }

  }

  // Сортировка по иерархии: 0, 1, 1.1, 1.2, 2, 2.1, 2.1.1, ...
  rows.sort(function (a, b) {
    var aidA = a.assembly_id || '';
    var aidB = b.assembly_id || '';
    if (aidA !== aidB) return aidA.localeCompare(aidB);

    var sa = (a.struct_id || a.id || '0').split('.');
    var sb = (b.struct_id || b.id || '0').split('.');
    for (var i = 0; i < Math.max(sa.length, sb.length); i++) {
      var na = parseInt(sa[i]) || 0;
      var nb = parseInt(sb[i]) || 0;
      if (na !== nb) return na - nb;
    }
    return sa.length - sb.length;
  });

  var countEl = document.getElementById('arc-db-count');
  if (countEl) countEl.textContent = catArcDB.length;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:24px;font-size:12px;">'
      + (filter ? 'Ничего не найдено' : 'Архив пуст.') + '</td></tr>';
    return;
  }

  var levelColors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
  var rowBgs = [
    'rgba(16,185,129,0.10)',
    'rgba(245,158,11,0.08)',
    'rgba(59,130,246,0.06)',
    'rgba(139,92,246,0.05)',
    'rgba(236,72,153,0.04)'
  ];

  var prevAid = '';
  tbody.innerHTML = rows.map(function (r) {
    var lvl = parseInt(r.level) || 0;
    var colorIdx = Math.min(lvl, 4);
    var sid = r.struct_id || r.id || '—';
    var aid = r.assembly_id || r.assemblyId || '—';
    var isNewGroup = aid !== prevAid;
    prevAid = aid;
    var groupBorder = isNewGroup ? 'border-top:2px solid ' + levelColors[0] + ';' : '';
    var nameWeight = lvl === 0 ? '700' : '400';
    var indent = lvl > 0 ? 'padding-left:' + (lvl * 16) + 'px;' : '';
    var labor = r.labor_hours || '';
    var noOps = (!labor && r.object_type !== 'ПКИ' && lvl > 0) ? ' style="background:var(--red-bg);color:var(--red-text);font-size:9px;padding:2px 6px;border-radius:3px"' : '';
    var laborDisplay = labor ? labor : (r.object_type === 'ПКИ' || lvl === 0 ? '' : '<span' + noOps + '>нет операций</span>');
    // var serial = r.serial_order || '';
    var serial = r.serial_number || r.serial_order || '';

    return '<tr style="background:' + rowBgs[colorIdx] + ';' + groupBorder + '">'
      + '<td class="mono" style="color:' + levelColors[0] + ';font-size:10px;white-space:nowrap;">' + aid + '</td>'
      + '<td style="font-size:10px;color:var(--text3);font-family:monospace">' + sid + '</td>'
      + '<td style="' + indent + 'font-weight:' + nameWeight + '">' + (r.item_name || r.name || '—') + '</td>'
      + '<td class="mono" style="font-size:10px;color:var(--text2)">' + (r.classifier || '—') + '</td>'
      + '<td><span class="badge" style="font-size:9px;background:' + rowBgs[colorIdx] + ';color:' + levelColors[colorIdx] + ';border:1px solid ' + levelColors[colorIdx] + '">' + (r.object_type || r.objectType || '—') + '</span></td>'
      + '<td class="mono" style="text-align:center">' + (r.quantity || 1) + '</td>'
      + '<td><div class="lvl-badge lvl-' + colorIdx + '">' + lvl + '</div></td>'
      + '<td class="mono" style="font-size:10px;color:var(--text3)">' + (r.parent_id || r.parentId || '—') + '</td>'
      + '<td style="text-align:right;font-family:monospace">' + laborDisplay + '</td>'
      + '<td class="mono" style="text-align:center;color:var(--amber-text);font-weight:700">' + serial + '</td>'
      + '<td style="font-size:10px;color:var(--text3)">' + (r.creator_name || '') + '</td>'
      + '</tr>';
  }).join('');
}

// ── ФИЛЬТРАЦИЯ АРХИВА ─────────────────────────────────────
function CatFilterArchive(q) {
  let selectedElement = parseInt(document.querySelector(".parentLi span.selected")?.parentElement.dataset.id);
  catRenderArchive(q || undefined, selectedElement || undefined);
}

function CatFilterArchiveByParentId(id) {
  let searcElementValue = document.getElementById("cat-search").value;
  id = parseInt(id);
  catRenderArchive(searcElementValue, id);
}



function catLoadFromDBPrompt() {
  var assemblyId = prompt('Введите обозначение головного изделия (Assembly_ID):');
  if (!assemblyId) return;
  assemblyId = assemblyId.trim();

  api('GET', '/api/archive?assembly_id=' + encodeURIComponent(assemblyId)).then(function (res) {
    if (res.ok && res.rows && res.rows.length > 0) {
      if (confirm('Найдена структура: ' + res.rows.length + ' элементов.\nЗагрузить для редактирования?')) {
        arcLoadStructure(assemblyId);
      }
    } else {
      showToast('Структура "' + assemblyId + '" не найдена в базе');
    }
  });
}


//Логика каталога

function findCildren(obj, db = []) {
  if (!db) return;
  let { assembly_id, parent_id, struct_id } = obj;
  return db.filter((value) => { return value.assembly_id === assembly_id && value.parent_id === struct_id && parent_id !== value.struct_id });
}

function recursivePopulateProductWithChildrens(obj, db) {
  let children = findCildren(obj, db);
  if (children.length > 0) {
    obj.children = children;
    obj.children.forEach(element => {
      recursivePopulateProductWithChildrens(element, db);
    });
  };

  return obj

};

function getProductsStructure(db) {
  let organisedStruct = [];

  for (let item of db) {
    recursivePopulateProductWithChildrens(item, db);
    if (item.struct_id === "0") { organisedStruct.push(item) };

  }

  return organisedStruct

};


function prepareCatalogueStructureElement(db) {
  let productsStructure = getProductsStructure(db);

  const fragment = document.createDocumentFragment();
  const navBlock = document.createElement("nav");
  const navUl = document.createElement("ul");
  navBlock.setAttribute("class", "nomNav");
  navUl.setAttribute("class", "nomNavList");
  navBlock.appendChild(navUl);

  for (let product of productsStructure) {
    const parentli = document.createElement("li");
    parentli.classList.add("parentLi");
    product.children ? parentli.classList.add("hasChildren") : null;
    parentli.setAttribute("data-id", product.id);
    navUl.appendChild(parentli);
    const innerSpan = document.createElement("span");
    innerSpan.textContent = `${product.classifier || product.assembly_id} ${product.item_name}(${product.struct_id})${product.children ? "(" + product.children.length + "+)" : ""}`;
    parentli.appendChild(innerSpan);

  }

  fragment.appendChild(navBlock);

  return fragment

};



function childrenElementsConstruct(chidrenArray) {
  let fragment = document.createDocumentFragment();
  if (chidrenArray && chidrenArray.length > 0) {
    const childUl = document.createElement("ul");
    childUl.setAttribute("class", "childUl");
    fragment.appendChild(childUl);

    chidrenArray.forEach((el) => {
      const childLi = document.createElement("li");
      childLi.classList.add("childLi");
      childLi.setAttribute("data-id", el.id);

      el.children ? childLi.classList.add("hasChildren") : null;
      const innerSpan = document.createElement("span");
      innerSpan.textContent = `${el.classifier || el.assembly_id} ${el.item_name}(${el.struct_id})${el.children ? "(" + el.children.length + "+)" : ""}`;
      childLi.appendChild(innerSpan);
      childUl.appendChild(childLi);

    }
    );

  }
  return fragment

}


function prepareProductCatalogue() {
  const catElement = document.getElementById("productTree");

  if (catElement) {
    catElement.replaceChildren(prepareCatalogueStructureElement(catArcDB));
  }

  let navlist = document.querySelector(".nomNavList")
  navlist.addEventListener("click", (e) => {
    let target = e.target.parentElement;
    let nom_id = parseInt(target.dataset.id);

    if (target.classList.contains("hasChildren")) {


      targetInDB = catArcDB.find((e) => { return e.id === nom_id })
      let children = findCildren(targetInDB, catArcDB);

      let childrenElement = childrenElementsConstruct(children);
      target.childElementCount === 1 ? target.replaceChildren(target.children[0], childrenElement) : target.replaceChildren(target.children[0]);



    }

    Array.from(navlist.querySelectorAll("li span")).forEach((e) => {
      e.classList.remove("selected");
    })

    target.querySelector("span").classList.add("selected");

    if (nom_id) {
      CatFilterArchiveByParentId(nom_id);
    };
  });

};

