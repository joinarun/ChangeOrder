import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleAnalysis, seedProject } from '../server/seed.js';
import { matchesDemoSources } from '../src/demo-fixture.js';

test('prewritten findings reject amended agreements and added or edited requests', () => {
  const original = seedProject();
  assert.equal(matchesDemoSources(original), true);
  assert.equal(sampleAnalysis(original).mode, 'sample');

  const amended = structuredClone(original);
  amended.brief += '\nAmendment: mobile checkout is now included in the original fee.';
  const added = structuredClone(original);
  added.messages.push({ ...added.messages[0]!, id: 'new-request', text: 'Add a members area.' });
  const edited = structuredClone(original);
  edited.messages[1]!.text += ' This addition was already agreed at no extra charge.';

  for (const project of [amended, added, edited]) {
    assert.equal(matchesDemoSources(project), false);
    assert.throws(() => sampleAnalysis(project), /Sample analysis works with the supplied/);
  }
});
