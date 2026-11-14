/**
 * Ignis Atlas — Scenario Evaluator & Telemetry Drawer
 * Provides neutral scenario inspection and formula-based pO2 computation.
 * (Unofficial student tool, not a NASA certification engine)
 */

export class IgnisOracle {
  constructor(options = {}) {
    this.atlas = options.atlas || null;
    this.isOpen = false;
    this.init();
  }

  init() {
    this.injectOracleHTML();
    this.bindEvents();
  }

  injectOracleHTML() {
    const existing = document.getElementById('oracle-slideover');
    if (existing) existing.remove();

    const trigger = document.createElement('button');
    trigger.id = 'oracle-dock-trigger';
    trigger.className = 'oracle-dock-trigger';
    trigger.setAttribute('aria-label', 'Open Scenario Evaluator Drawer');
    trigger.innerHTML = `
      <span class="dock-pulse-glow" aria-hidden="true"></span>
      <div class="dock-content">
        <span class="dock-status-dot" aria-hidden="true"></span>
        <span class="dock-title mono">SCENARIO EVALUATOR</span>
      </div>
    `;
    document.body.appendChild(trigger);

    const slideover = document.createElement('aside');
    slideover.id = 'oracle-slideover';
    slideover.className = 'oracle-slideover';
    slideover.setAttribute('aria-hidden', 'true');
    slideover.innerHTML = `
      <div class="oracle-backdrop" id="oracle-backdrop"></div>
      <div class="oracle-drawer glass-card">
        <!-- Header -->
        <div class="oracle-header">
          <div>
            <div class="oracle-tag-row">
              <span class="oracle-pill mono">SCENARIO EVALUATION AID</span>
            </div>
            <h2 class="oracle-title mono">IGNIS SCENARIO EVALUATOR</h2>
            <p class="oracle-sub">Interactive Environmental Telemetry Screening</p>
          </div>
          <div class="oracle-header-actions">
            <button id="oracle-close-btn" class="icon-btn" aria-label="Close Drawer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="oracle-body">
          <!-- Parameter Tuning Deck -->
          <div class="oracle-tuning-card glass-card">
            <div class="tuning-header">
              <span class="tuning-tag mono">TELEMETRY INPUTS</span>
              <span class="tuning-sub">O₂ FRACTION &bull; TOTAL PRESSURE</span>
            </div>

            <!-- Preset Pills -->
            <div class="preset-pill-row">
              <button type="button" class="preset-pill active" data-o2="30.0" data-p="10.2" data-g="0.16g" data-flow="10.0" data-mat="PMMA (Acrylic)">Lunar Exploration Spec (≥30% / 10.2 PSI)</button>
              <button type="button" class="preset-pill" data-o2="21.0" data-p="14.7" data-g="0.00g" data-flow="2.5" data-mat="Cotton-Fiberglass Fabric">ISS Cabin (21% / 14.7 PSI)</button>
            </div>

            <!-- Sliders Grid -->
            <div class="tuning-grid">
              <div class="control-box">
                <div class="control-label-row">
                  <label for="agent-slider-o2">Oxygen (O₂)</label>
                  <span id="agent-val-o2" class="c-val mono">30.0%</span>
                </div>
                <input type="range" id="agent-slider-o2" class="agent-slider" min="15" max="100" step="0.5" value="30.0" />
              </div>

              <div class="control-box">
                <div class="control-label-row">
                  <label for="agent-slider-p">Chamber Pressure</label>
                  <span id="agent-val-p" class="c-val mono">10.2 PSI</span>
                </div>
                <input type="range" id="agent-slider-p" class="agent-slider" min="2" max="16.5" step="0.1" value="10.2" />
              </div>

              <div class="control-box">
                <div class="control-label-row">
                  <label for="agent-select-g">Gravity Field</label>
                  <span id="agent-val-g" class="c-val mono">0.16g</span>
                </div>
                <select id="agent-select-g" class="agent-select mono">
                  <option value="0.16g" selected>0.16g (Lunar - unmeasured)</option>
                  <option value="0.00g">0.00g (Orbital Microgravity)</option>
                  <option value="0.38g">0.38g (Martian)</option>
                  <option value="1.00g">1.00g (Earth Sea Level)</option>
                </select>
              </div>

              <div class="control-box">
                <div class="control-label-row">
                  <label for="agent-slider-flow">Ventilation Flow</label>
                  <span id="agent-val-flow" class="c-val mono">10.0 cm/s</span>
                </div>
                <input type="range" id="agent-slider-flow" class="agent-slider" min="0" max="40" step="0.5" value="10.0" />
              </div>

              <div class="control-box full-w">
                <div class="control-label-row">
                  <label for="agent-select-mat">Material Tested</label>
                </div>
                <select id="agent-select-mat" class="agent-select mono">
                  <option value="PMMA (Acrylic)" selected>PMMA (Acrylic)</option>
                  <option value="Cotton-Fiberglass Fabric">Cotton-Fiberglass Fabric</option>
                  <option value="Nomex Fabric">Nomex Fabric</option>
                  <option value="Polyethylene">Polyethylene</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <button id="btn-run-agent-audit" class="agent-audit-btn mono">
            <span>EVALUATE SCENARIO PARAMETERS</span>
          </button>

          <!-- Result Card Container -->
          <div id="oracle-summary-container" class="oracle-summary-container"></div>
        </div>
      </div>
    `;
    document.body.appendChild(slideover);
  }

  bindEvents() {
    const trigger = document.getElementById('oracle-dock-trigger');
    const closeBtn = document.getElementById('oracle-close-btn');
    const backdrop = document.getElementById('oracle-backdrop');
    const auditBtn = document.getElementById('btn-run-agent-audit');

    if (trigger) trigger.addEventListener('click', () => this.open());
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (backdrop) backdrop.addEventListener('click', () => this.close());

    document.querySelectorAll('.trigger-open-oracle').forEach((btn) => {
      btn.addEventListener('click', () => this.open());
    });

    const sO2 = document.getElementById('agent-slider-o2');
    const sP = document.getElementById('agent-slider-p');
    const sFlow = document.getElementById('agent-slider-flow');
    const selG = document.getElementById('agent-select-g');

    const updateReadouts = () => {
      const vO2 = document.getElementById('agent-val-o2');
      const vP = document.getElementById('agent-val-p');
      const vFlow = document.getElementById('agent-val-flow');
      const vG = document.getElementById('agent-val-g');
      if (vO2 && sO2) vO2.textContent = `${parseFloat(sO2.value).toFixed(1)}%`;
      if (vP && sP) vP.textContent = `${parseFloat(sP.value).toFixed(1)} PSI`;
      if (vFlow && sFlow) vFlow.textContent = `${parseFloat(sFlow.value).toFixed(1)} cm/s`;
      if (vG && selG) vG.textContent = selG.value;
    };

    if (sO2) sO2.addEventListener('input', updateReadouts);
    if (sP) sP.addEventListener('input', updateReadouts);
    if (sFlow) sFlow.addEventListener('input', updateReadouts);
    if (selG) selG.addEventListener('change', updateReadouts);

    document.querySelectorAll('.preset-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.preset-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        if (sO2) sO2.value = pill.dataset.o2;
        if (sP) sP.value = pill.dataset.p;
        if (selG) selG.value = pill.dataset.g;
        if (sFlow) sFlow.value = pill.dataset.flow;
        const selMat = document.getElementById('agent-select-mat');
        if (selMat && pill.dataset.mat) selMat.value = pill.dataset.mat;
        updateReadouts();
      });
    });

    if (auditBtn) {
      auditBtn.addEventListener('click', () => this.evaluateAndRender());
    }
  }

  open() {
    const slideover = document.getElementById('oracle-slideover');
    if (!slideover) return;
    slideover.classList.add('open');
    slideover.setAttribute('aria-hidden', 'false');
    this.isOpen = true;
  }

  close() {
    const slideover = document.getElementById('oracle-slideover');
    if (!slideover) return;
    slideover.classList.remove('open');
    slideover.setAttribute('aria-hidden', 'true');
    this.isOpen = false;
  }

  evaluateAndRender() {
    const sO2 = document.getElementById('agent-slider-o2');
    const sP = document.getElementById('agent-slider-p');
    const selG = document.getElementById('agent-select-g');
    const sFlow = document.getElementById('agent-slider-flow');
    const selMat = document.getElementById('agent-select-mat');

    const o2 = sO2 ? parseFloat(sO2.value) : 30.0;
    const p_psi = sP ? parseFloat(sP.value) : 10.2;
    const gravity = selG ? selG.value : '0.16g';
    const flow = sFlow ? parseFloat(sFlow.value) : 10.0;
    const material = selMat ? selMat.value : 'PMMA (Acrylic)';

    // Formula: pO2 = (O2 fraction) * (Total pressure in kPa)
    // 1 psi = 6.89476 kPa
    const p_kpa = p_psi * 6.89476;
    const po2_kpa = (o2 / 100) * p_kpa;

    // Find closest experiment in dataset
    const experiments = (this.atlas && this.atlas.experiments) ? this.atlas.experiments : [];
    let closestExp = null;
    let minDistance = Infinity;

    experiments.forEach((exp) => {
      if (exp.is_gap) return;
      const expO2Mid = exp.o2 ? (exp.o2[0] + exp.o2[1]) / 2 : 50;
      const expPMid = exp.pressure_psi ? (exp.pressure_psi[0] + exp.pressure_psi[1]) / 2 : 8;
      const d = Math.sqrt(Math.pow((o2 - expO2Mid) / 100, 2) + Math.pow((p_psi - expPMid) / 16.5, 2));
      if (d < minDistance) {
        minDistance = d;
        closestExp = exp;
      }
    });

    // Material coverage determination
    let statusText = 'EXTRAPOLATED';
    if (gravity !== '0.00g') {
      statusText = 'EXTRAPOLATED (Partial gravity flammability unmeasured in PSI)';
    } else if (closestExp && closestExp.o2 && o2 >= closestExp.o2[0] && o2 <= closestExp.o2[1] &&
               closestExp.pressure_psi && p_psi >= closestExp.pressure_psi[0] && p_psi <= closestExp.pressure_psi[1]) {
      statusText = 'COVERED (Within recorded flight bounds)';
    } else {
      statusText = 'EXTRAPOLATED (Outside recorded bounds)';
    }

    const container = document.getElementById('oracle-summary-container');
    if (!container) return;

    container.innerHTML = `
      <div class="neutral-summary-card glass-card" style="margin-top:20px; padding:18px; border:1px solid rgba(0,240,255,0.25); border-radius:8px;">
        <div style="font-size:0.75rem; color:#00F0FF; font-family:monospace; margin-bottom:8px;">
          IGNIS ATLAS SCENARIO SUMMARY (UNOFFICIAL, NOT A NASA DOCUMENT)
        </div>

        <div style="font-size:0.8rem; margin-bottom:12px; line-height:1.6;">
          <strong>Inputs:</strong> ${o2.toFixed(1)}% O₂ &bull; ${p_psi.toFixed(1)} PSI (${p_kpa.toFixed(1)} kPa) &bull; ${gravity} &bull; ${flow.toFixed(1)} cm/s flow &bull; Material: ${material}
        </div>

        <div style="font-size:0.8rem; margin-bottom:12px; line-height:1.6; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:4px; font-family:monospace;">
          <strong>Oxygen Partial Pressure:</strong><br/>
          Formula: pO₂ = (O₂ % / 100) × Total Pressure<br/>
          Calculation: (${o2.toFixed(1)} / 100) × ${p_kpa.toFixed(1)} kPa = <strong>${po2_kpa.toFixed(1)} kPa</strong>
        </div>

        <div style="font-size:0.8rem; margin-bottom:12px; line-height:1.6;">
          <strong>Material Coverage Status:</strong> ${statusText}
        </div>

        ${closestExp ? `
        <div style="font-size:0.8rem; margin-bottom:12px; line-height:1.6;">
          <strong>Closest PSI Flight Record:</strong> ${closestExp.id} (${closestExp.name})<br/>
          <strong>Link:</strong> <a href="${closestExp.psi_url || '#'}" target="_blank" rel="noopener noreferrer" style="color:#00F0FF;">${closestExp.psi_url || 'PSI Record'}</a><br/>
          <strong>Recorded Ranges:</strong> O₂: ${closestExp.o2 ? closestExp.o2[0] + '–' + closestExp.o2[1] + '%' : 'not recorded'} &bull; Pressure: ${closestExp.pressure_psi ? closestExp.pressure_psi[0] + '–' + closestExp.pressure_psi[1] + ' psi' : 'not recorded'}
        </div>` : ''}

        <div style="font-size:0.75rem; color:#94A3B8; margin-top:14px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px; line-height:1.5;">
          <strong>Limitations:</strong> Ignis Atlas is an open-access research aid developed for educational and screening purposes. It is not an engineering certification, does not predict stochastic fire spread or ignition probability, and does not replace standardized flammability testing under NASA-STD-6001.
        </div>

        <button id="btn-export-scenario-txt" class="btn-ghost mono" style="margin-top:14px; width:100%; padding:8px; font-size:0.75rem;">
          Export Scenario Summary (.TXT)
        </button>
      </div>
    `;

    const exportBtn = document.getElementById('btn-export-scenario-txt');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const text = [
          '========================================================================',
          'IGNIS ATLAS SCENARIO SUMMARY (UNOFFICIAL, NOT A NASA DOCUMENT)',
          '========================================================================',
          '',
          `Scenario Inputs:`,
          `  - Oxygen Concentration: ${o2.toFixed(1)}%`,
          `  - Chamber Total Pressure: ${p_psi.toFixed(1)} PSI (${p_kpa.toFixed(1)} kPa)`,
          `  - Gravitational Regime: ${gravity}`,
          `  - Forced Ventilation Airflow: ${flow.toFixed(1)} cm/s`,
          `  - Material Screened: ${material}`,
          '',
          `Oxygen Partial Pressure (pO2):`,
          `  - Formula: pO2 = (O2 fraction) * (Total Pressure in kPa)`,
          `  - Computed Value: (${o2.toFixed(1)} / 100) * ${p_kpa.toFixed(1)} kPa = ${po2_kpa.toFixed(1)} kPa`,
          '',
          `Material Coverage Status:`,
          `  - Evaluation: ${statusText}`,
          '',
          closestExp ? [
            `Closest NASA PSI Flight Record:`,
            `  - ID: ${closestExp.id}`,
            `  - Investigation: ${closestExp.name}`,
            `  - DOI: ${closestExp.doi || 'not recorded'}`,
            `  - PSI Repository URL: ${closestExp.psi_url || 'not recorded'}`,
            `  - Recorded O2 Range: ${closestExp.o2 ? closestExp.o2[0] + '–' + closestExp.o2[1] + '%' : 'not recorded'}`,
            `  - Recorded Pressure Range: ${closestExp.pressure_psi ? closestExp.pressure_psi[0] + '–' + closestExp.pressure_psi[1] + ' psi' : 'not recorded'}`,
          ].join('\n') : '',
          '',
          `Limitations:`,
          `  Ignis Atlas is an open-access screening aid. It is not an engineering`,
          `  safety certification and does not replace compliance testing under NASA-STD-6001.`,
          '========================================================================'
        ].join('\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ignis-atlas-scenario-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
  }
}
