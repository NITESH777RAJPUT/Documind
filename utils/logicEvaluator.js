// utils/logicEvaluator.js

function evaluateLogic(clauses) {
  const evaluations = [];

  if (clauses.confidentiality) {
    evaluations.push("✅ Confidentiality clause is present.");
  } else {
    evaluations.push("⚠️ No confidentiality clause found.");
  }

  if (clauses.termination && typeof clauses.termination === 'string') {
    const days = parseInt(clauses.termination.match(/\d+/)?.[0]);
    if (days && days < 30) {
      evaluations.push(`⚠️ Termination period is only ${days} days. Consider increasing it.`);
    } else {
      evaluations.push("✅ Termination period seems acceptable.");
    }
  } else {
    evaluations.push("⚠️ Termination clause is missing or not clearly defined.");
  }

  if (clauses.parties && clauses.parties.includes(" and ")) {
    evaluations.push("✅ Both parties are mentioned.");
  } else {
    evaluations.push("⚠️ Parties clause might be incomplete or unclear.");
  }

  return evaluations;
}

module.exports = { evaluateLogic };
