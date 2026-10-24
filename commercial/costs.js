'use strict';

// Integer grosze throughout. Planning scenarios only, never provider billing.
function evaluate(plan, assumptions, options = {}) {
  const vatPercent = options.vatPercent ?? assumptions.vatStressPercent;
  const multiplier = options.variableMultiplierPercent ?? 100;
  if (![vatPercent, multiplier].every(Number.isFinite) || vatPercent < 0 || multiplier < 0) throw new RangeError('Invalid scenario');
  const inputs = ['setupCents', 'monthlyCents', 'minutes', 'smsParts', 'assumedMinuteCostCents', 'fixedMonthlyCostCents', 'monthlyLaborHours', 'monthlyReserveCents', 'setupLaborHours', 'setupExternalCostCents', 'setupReserveCents'].map(key => plan[key]);
  inputs.push(assumptions.smsPartCostCents, assumptions.laborHourCostCents);
  if (inputs.some(value => !Number.isFinite(value) || value < 0)) throw new RangeError('Invalid commercial cost data');
  const net = gross => Math.round(gross * 100 / (100 + vatPercent));
  const monthlyNetCents = net(plan.monthlyCents);
  const variableCents = Math.round((plan.minutes * plan.assumedMinuteCostCents + plan.smsParts * assumptions.smsPartCostCents) * multiplier / 100);
  const laborCents = Math.round(plan.monthlyLaborHours * assumptions.laborHourCostCents);
  const monthlyCostCents = variableCents + plan.fixedMonthlyCostCents + laborCents + plan.monthlyReserveCents;
  const setupNetCents = net(plan.setupCents);
  const setupCostCents = Math.round(plan.setupLaborHours * assumptions.laborHourCostCents) + plan.setupExternalCostCents + plan.setupReserveCents;
  return {
    monthlyNetCents, variableCents, laborCents, monthlyCostCents,
    monthlySurplusCents: monthlyNetCents - monthlyCostCents,
    setupNetCents, setupCostCents, setupSurplusCents: setupNetCents - setupCostCents,
    firstYearGrossCents: plan.setupCents + plan.monthlyCents * 12,
  };
}

module.exports = { evaluate };
