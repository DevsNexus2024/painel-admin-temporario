
import { TcrDeposit, ExternalDeposit, ComparisonResult } from '../types/deposit';

export const compareDeposits = (
  tcrDeposits: TcrDeposit[],
  externalDeposits: ExternalDeposit[],
  searchAmount?: string
): ComparisonResult[] => {
  // Filter external deposits by amount if provided
  const filteredExternalDeposits = searchAmount 
    ? externalDeposits.filter(deposit => deposit.value === searchAmount)
    : externalDeposits;

  // Create a lookup map for faster matching
  const tcrDepositsMap = new Map<number, TcrDeposit>();
  
  // Populate the map with TCR deposits, using external_id as the key
  tcrDeposits.forEach(tcrDeposit => {
    if (tcrDeposit.id_externo_bb) {
      tcrDepositsMap.set(Number(tcrDeposit.id_externo_bb), tcrDeposit);
    }
  });

  return filteredExternalDeposits.map(externalDeposit => {
    // Find matching deposit in TCR system by ID
    const matchingDeposit = tcrDepositsMap.get(externalDeposit.id);

    if (!matchingDeposit) {
      return {
        tcrDeposit: null,
        externalDeposit,
        status: 'not_found'
      };
    }

    // Check if amounts match (could add more validation here)
    const tcrAmount = parseFloat(matchingDeposit.quantia);
    const externalAmount = parseFloat(externalDeposit.value);
    
    if (Math.abs(tcrAmount - externalAmount) > 0.01) {
      return {
        tcrDeposit: matchingDeposit,
        externalDeposit,
        status: 'mismatch'
      };
    }

    return {
      tcrDeposit: matchingDeposit,
      externalDeposit,
      status: 'matched'
    };
  });
};
