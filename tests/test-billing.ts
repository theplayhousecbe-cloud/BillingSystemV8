
import { chargeForPerson, computeBill } from '../src/lib/billing';
import { Session, Person, PricingPlan } from '../src/lib/types';

// Mock data
const pricing: PricingPlan = {
  adultRate: 149,
  kidRate: 99,
  kidRateAbove10: 149,
  subsequentRate: 99,
  custom: false,
  selectAllMenu: false
};

const MS_PER_HOUR = 3600000;

function testBilling() {
  console.log("Running Billing Logic Tests...");

  // Scenario 1: Stay for 30 minutes (0.5h)
  // Expected: 149 (Flat fee for first hour)
  const p1: Person = {
    id: 'p1',
    label: 'A',
    kind: 'adult',
    joinedAt: 1000000,
    firstHourRate: 149
  };
  const charge1 = chargeForPerson(p1, 1000000 + 0.5 * MS_PER_HOUR, 99);
  console.log(`Scenario 1 (30m): Expected 149, Got ${charge1.total}`);
  if (charge1.total !== 149) throw new Error("Scenario 1 Failed");

  // Scenario 2: Stay for 60 minutes (1.0h)
  // Expected: 149 (Flat fee)
  const charge2 = chargeForPerson(p1, 1000000 + 1.0 * MS_PER_HOUR, 99);
  console.log(`Scenario 2 (60m): Expected 149, Got ${charge2.total}`);
  if (charge2.total !== 149) throw new Error("Scenario 2 Failed");

  // Scenario 3: Stay for 90 minutes (1.5h)
  // Expected: 149 + (0.5 * 99) = 149 + 49.5 = 198.5
  const charge3 = chargeForPerson(p1, 1000000 + 1.5 * MS_PER_HOUR, 99);
  console.log(`Scenario 3 (90m): Expected 198.5, Got ${charge3.total}`);
  if (charge3.total !== 198.5) throw new Error("Scenario 3 Failed");

  // Scenario 4: Stay for 2 hours (2.0h)
  // Expected: 149 + 99 = 248
  const charge4 = chargeForPerson(p1, 1000000 + 2.0 * MS_PER_HOUR, 99);
  console.log(`Scenario 4 (120m): Expected 248, Got ${charge4.total}`);
  if (charge4.total !== 248) throw new Error("Scenario 4 Failed");

  // Scenario 5: Cafe Only (0 rate)
  const p2: Person = {
    id: 'p2',
    label: 'B',
    kind: 'adult',
    joinedAt: 1000000,
    firstHourRate: 0
  };
  const charge5 = chargeForPerson(p2, 1000000 + 2.0 * MS_PER_HOUR, 99);
  console.log(`Scenario 5 (Cafe Only 120m): Expected 0, Got ${charge5.total}`);
  if (charge5.total !== 0) throw new Error("Scenario 5 Failed");

  console.log("\n✅ All Billing Logic Tests Passed!");
}

try {
  testBilling();
} catch (e: any) {
  console.error("\n❌ Test Failed:", e?.message || e);
  process.exit(1);
}
