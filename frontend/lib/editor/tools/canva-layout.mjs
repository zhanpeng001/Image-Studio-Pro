const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

function fallbackSegmentGraphemes(value) {
  const segments = [];
  let joinNext = false;

  for (const codePoint of Array.from(value)) {
    const isRegionalIndicator = /[\u{1F1E6}-\u{1F1FF}]/u.test(codePoint);
    const previousIsSingleIndicator = /^[\u{1F1E6}-\u{1F1FF}]$/u.test(segments[segments.length - 1] || '');

    if (
      segments.length > 0
      && (
        joinNext
        || codePoint === '\u200d'
        || /[\p{Mark}\uFE00-\uFE0F\u{1F3FB}-\u{1F3FF}]/u.test(codePoint)
        || (isRegionalIndicator && previousIsSingleIndicator)
      )
    ) {
      segments[segments.length - 1] += codePoint;
    } else {
      segments.push(codePoint);
    }
    joinNext = codePoint === '\u200d';
  }

  return segments;
}

export function segmentCanvaGraphemes(value, segmenter = graphemeSegmenter) {
  if (!segmenter) return fallbackSegmentGraphemes(value);

  return Array.from(segmenter.segment(value), ({ segment }) => segment);
}

function layoutParagraph(paragraph, maxWidth, measureText) {
  if (!paragraph) return [''];

  const characters = segmentCanvaGraphemes(paragraph);
  const lines = [];
  let start = 0;

  while (start < characters.length) {
    if (lines.length > 0 && /\S$/.test(lines[lines.length - 1])) {
      while (start < characters.length && /\s/.test(characters[start])) {
        start += 1;
      }
      if (start === characters.length) break;
    }

    let end = start;

    while (
      end < characters.length
      && measureText(characters.slice(start, end + 1).join('')) <= maxWidth
    ) {
      end += 1;
    }

    if (end === start) {
      lines.push(characters[start]);
      start += 1;
      continue;
    }

    if (end === characters.length) {
      lines.push(characters.slice(start).join(''));
      break;
    }

    let breakAt = end;
    for (let index = end - 1; index >= start; index -= 1) {
      if (/\s/.test(characters[index])) {
        breakAt = index + 1;
        break;
      }
    }

    lines.push(characters.slice(start, breakAt).join(''));
    start = breakAt;
  }

  return lines;
}

export function layoutCanvaText(text, maxWidth, measureText) {
  const paragraphs = String(text ?? '').split(/\r?\n/);

  if (maxWidth <= 0) return paragraphs;

  return paragraphs.flatMap((paragraph) => layoutParagraph(paragraph, maxWidth, measureText));
}

export function readCanvaEditableText(overlay) {
  return (overlay.innerText || '').replace(/\r\n?/g, '\n');
}

export function getCanvaTextOverlayRect(layer, zoom) {
  return {
    left: layer.x * zoom,
    top: layer.y * zoom,
    width: layer.w * zoom,
    height: layer.h * zoom,
  };
}

export function shouldPaintLayerContent(layer, selected) {
  return !(selected && layer.type === 'text');
}
