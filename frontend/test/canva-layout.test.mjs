import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCanvaTextOverlayRect,
  layoutCanvaText,
  readCanvaEditableText,
  segmentCanvaGraphemes,
  shouldPaintLayerContent,
} from '../lib/editor/tools/canva-layout.mjs';

const measure = (value) => value.length;
const codePointMeasure = (value) => Array.from(value).length;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemeMeasure = (value) => Array.from(graphemeSegmenter.segment(value)).length;

test('layoutCanvaText preserves explicit newlines', () => {
  assert.deepEqual(layoutCanvaText('one\ntwo', 10, measure), ['one', 'two']);
});

test('layoutCanvaText preserves empty text and blank lines', () => {
  assert.deepEqual(layoutCanvaText('', 10, measure), ['']);
  assert.deepEqual(layoutCanvaText('one\n\ntwo', 10, measure), ['one', '', 'two']);
});

test('layoutCanvaText preserves visible leading and repeated spaces', () => {
  assert.deepEqual(layoutCanvaText('  indented', 20, measure), ['  indented']);
  assert.deepEqual(layoutCanvaText('one   two', 20, measure), ['one   two']);
  assert.deepEqual(layoutCanvaText('    x', 2, measure), ['  ', '  ', 'x']);
});

test('layoutCanvaText suppresses separators consumed at automatic wrap boundaries', () => {
  const singleSpaceLines = layoutCanvaText('one two', 3, measure);
  const repeatedSpaceLines = layoutCanvaText('abc  d', 3, measure);

  assert.deepEqual(singleSpaceLines, ['one', 'two']);
  assert.deepEqual(repeatedSpaceLines, ['abc', 'd']);
  for (const line of [...singleSpaceLines, ...repeatedSpaceLines]) {
    assert.ok(measure(line) <= 3, `overflowing line: ${JSON.stringify(line)}`);
  }
});

test('layoutCanvaText splits over-wide words into fitting segments', () => {
  assert.deepEqual(layoutCanvaText('abcdefgh', 3, measure), ['abc', 'def', 'gh']);
});

test('layoutCanvaText splits over-wide text at Unicode code point boundaries', () => {
  assert.deepEqual(layoutCanvaText('🙂🙂', 1, codePointMeasure), ['🙂', '🙂']);
  assert.deepEqual(layoutCanvaText('🙂🙂', 0.5, codePointMeasure), ['🙂', '🙂']);
});

test('layoutCanvaText does not split grapheme clusters during forced wrapping', () => {
  assert.deepEqual(layoutCanvaText('👩‍💻👩‍💻', 1, graphemeMeasure), ['👩‍💻', '👩‍💻']);
  assert.deepEqual(layoutCanvaText('👩‍💻👩‍💻', 0.5, graphemeMeasure), ['👩‍💻', '👩‍💻']);
  assert.deepEqual(layoutCanvaText('e\u0301e\u0301', 0.5, graphemeMeasure), ['e\u0301', 'e\u0301']);
});

test('segmentCanvaGraphemes preserves common clusters without Intl.Segmenter', () => {
  assert.deepEqual(segmentCanvaGraphemes('e\u0301e\u0301', null), ['e\u0301', 'e\u0301']);
  assert.deepEqual(segmentCanvaGraphemes('👩‍💻👩‍💻', null), ['👩‍💻', '👩‍💻']);
});

test('segmentCanvaGraphemes preserves emoji modifiers without Intl.Segmenter', () => {
  assert.deepEqual(segmentCanvaGraphemes('👍🏽', null), ['👍🏽']);
  assert.deepEqual(segmentCanvaGraphemes('👍🏽👍🏻', null), ['👍🏽', '👍🏻']);
});

test('segmentCanvaGraphemes pairs flag indicators without Intl.Segmenter', () => {
  assert.deepEqual(segmentCanvaGraphemes('🇸🇬', null), ['🇸🇬']);
  assert.deepEqual(segmentCanvaGraphemes('🇸🇬🇺🇸', null), ['🇸🇬', '🇺🇸']);
});

test('layoutCanvaText does not loop or throw for non-positive maximum widths', () => {
  assert.deepEqual(layoutCanvaText('one\n\ntwo', 0, measure), ['one', '', 'two']);
  assert.deepEqual(layoutCanvaText('text', -1, measure), ['text']);
});

test('readCanvaEditableText normalizes visible browser line endings', () => {
  assert.equal(readCanvaEditableText({ innerText: 'one\r\ntwo' }), 'one\ntwo');
});

test('readCanvaEditableText returns empty text for empty or nullish visible content', () => {
  assert.equal(readCanvaEditableText({ innerText: '' }), '');
  assert.equal(readCanvaEditableText({ innerText: null }), '');
  assert.equal(readCanvaEditableText({}), '');
});

test('shouldPaintLayerContent suppresses selected text while retaining icons', () => {
  assert.equal(shouldPaintLayerContent({ type: 'text' }, true), false);
  assert.equal(shouldPaintLayerContent({ type: 'icon' }, true), true);
});

test('getCanvaTextOverlayRect uses layer coordinates within the scrolled canvas area', () => {
  assert.deepEqual(
    getCanvaTextOverlayRect({ x: 120, y: 80, w: 300, h: 60 }, 2),
    { left: 240, top: 160, width: 600, height: 120 },
  );
});
