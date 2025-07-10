let data = {};
let charts = [];

async function loadJSON() {
  const res = await fetch("./final_report.json");
  data = await res.json();
  document.getElementById("addModelBtn").onclick = () => addModelSelector();
  document.getElementById("generateReport").onclick = () => generateReport();
  addModelSelector();
}

function addModelSelector() {
  const container = document.getElementById("modelContainer");
  const block = document.createElement("div");
  block.className = "model-block";

  const cprSel = createDropdown(Object.keys(data));
  const scnSel = createDropdown([]);
  const mdlSel = createDropdown([]);

  cprSel.onchange = () => {
    scnSel.innerHTML = "";
    Object.keys(data[cprSel.value]).forEach(s => {
      scnSel.appendChild(new Option(s, s));
    });
    scnSel.dispatchEvent(new Event("change"));
  };

  scnSel.onchange = () => {
    mdlSel.innerHTML = "";
    Object.keys(data[cprSel.value][scnSel.value]).forEach(m => {
      mdlSel.appendChild(new Option(m, m));
    });
  };

  block.appendChild(cprSel);
  block.appendChild(scnSel);
  block.appendChild(mdlSel);
  container.appendChild(block);

  cprSel.dispatchEvent(new Event("change"));
}

function createDropdown(values) {
  const sel = document.createElement("select");
  values.forEach(v => sel.appendChild(new Option(v, v)));
  return sel;
}

function generateReport() {
  const opts = {
    metrics: document.getElementById("optMetrics").checked,
    graphs: document.getElementById("optGraphs").checked,
    reports: document.getElementById("optReports").checked
  };

  const modelBlocks = document.querySelectorAll(".model-block");
  const selectedModels = [];

  modelBlocks.forEach(block => {
    const [cpr, scn, mdl] = block.querySelectorAll("select");
    const summary = data[cpr.value]?.[scn.value]?.[mdl.value]?.summary;
    if (summary) {
      selectedModels.push({
        label: `${cpr.value} | ${scn.value} | ${mdl.value}`,
        summary,
        report: data[cpr.value][scn.value][mdl.value].folds["1"]?.classification_report?.loss_report || {}
      });
    }
  });

  renderReport(selectedModels, opts);
}

function renderReport(models, opts) {
  const out = document.getElementById("reportOutput");
  out.innerHTML = "";
  charts.forEach(c => c.destroy());
  charts = [];

  const metrics = Object.keys(models[0]?.summary || {}).filter(k => Array.isArray(models[0].summary[k]));

  if (opts.metrics) {
    const metricGrid = document.createElement("div");
    metricGrid.className = "metric-grid";

    models.forEach(m => {
      const col = document.createElement("div");
      col.className = "metric-column";
      col.innerHTML = `<h4>${m.label}</h4>`;
      metrics.forEach(k => {
        col.innerHTML += `<div><strong>${k}</strong>: ${last(m.summary[k])}</div>`;
      });
      metricGrid.appendChild(col);
    });

    out.appendChild(metricGrid);
  }

  if (opts.graphs) {
    const lossRow = document.createElement("div");
    lossRow.className = "canvas-row";
    const accRow = document.createElement("div");
    accRow.className = "canvas-row";

    models.forEach(m => {
      // Loss graph
      const lossCanvas = document.createElement("canvas");
      lossRow.appendChild(lossCanvas);
      const lossCtx = lossCanvas.getContext("2d");
      charts.push(new Chart(lossCtx, {
        type: "line",
        data: {
          labels: Array.from({ length: m.summary.train_loss_history?.length || 0 }, (_, i) => i + 1),
          datasets: [
            {
              label: "Train Loss",
              data: m.summary.train_loss_history,
              borderWidth: 2,
              fill: false
            },
            {
              label: "Val Loss",
              data: m.summary.val_loss_history,
              borderWidth: 2,
              fill: false
            }
          ]
        },
        options: { responsive: true, plugins: { title: { display: true, text: m.label + " - Loss" } } }
      }));

      // Accuracy graph
      const accCanvas = document.createElement("canvas");
      accRow.appendChild(accCanvas);
      const accCtx = accCanvas.getContext("2d");
      charts.push(new Chart(accCtx, {
        type: "line",
        data: {
          labels: Array.from({ length: m.summary.train_acc_history?.length || 0 }, (_, i) => i + 1),
          datasets: [
            {
              label: "Train Accuracy",
              data: m.summary.train_acc_history,
              borderWidth: 2,
              fill: false
            },
            {
              label: "Val Accuracy",
              data: m.summary.val_acc_history,
              borderWidth: 2,
              fill: false
            }
          ]
        },
        options: { responsive: true, plugins: { title: { display: true, text: m.label + " - Accuracy" } } }
      }));
    });

    out.appendChild(lossRow);
    out.appendChild(accRow);
  }

  if (opts.reports) {
    const reportRow = document.createElement("div");
    reportRow.className = "report-row";

    models.forEach(m => {
      const wrapper = document.createElement("div");
      wrapper.style.minWidth = "300px";
      wrapper.innerHTML = `<h4 style="text-align:center; margin-bottom:10px;">${m.label}</h4>`;


      const tbl = document.createElement("table");
      tbl.className = "report-table";
      tbl.innerHTML = `
        <thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr></thead>`;
      const tb = document.createElement("tbody");

      Object.entries(m.report).forEach(([cls, vals]) => {
        if (!vals || vals.precision === undefined) return;
        tb.innerHTML += `<tr><td>${cls}</td>
          <td>${vals.precision.toFixed(3)}</td>
          <td>${vals.recall.toFixed(3)}</td>
          <td>${vals["f1-score"].toFixed(3)}</td>
          <td>${vals.support}</td></tr>`;
      });

      tbl.appendChild(tb);
      wrapper.appendChild(tbl);
      reportRow.appendChild(wrapper);
    });

    out.appendChild(reportRow);
  }
}

function last(arr) {
  return arr?.length ? arr[arr.length - 1].toFixed(4) : "—";
}

loadJSON();

