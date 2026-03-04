import { Generator, TargetFormat } from './types';
import { autoGenerator } from '../generators/auto';
import { clashGenerator } from '../generators/clash';
import { clashrGenerator } from '../generators/clashr';
import { clashMetaGenerator } from '../generators/clash-meta';
import { singboxGenerator } from '../generators/singbox';
import { surgeGenerator } from '../generators/surge';
import { surgemacGenerator } from '../generators/surgemac';
import { egernGenerator } from '../generators/egern';
import { quantumultxGenerator } from '../generators/quantumultx';
import { shadowrocketGenerator } from '../generators/shadowrocket';
import { loonGenerator } from '../generators/loon';
import { v2rayGenerator } from '../generators/v2ray';
import { v2rayUriGenerator } from '../generators/v2ray-uri';
import { mixedGenerator } from '../generators/mixed';
import { base64Generator } from '../generators/base64';
import { stashGenerator } from '../generators/stash';
import { surfboardGenerator } from '../generators/surfboard';
import { plainJsonGenerator } from '../generators/plain-json';

const generators: Map<TargetFormat, Generator> = new Map();

[autoGenerator, clashGenerator, clashrGenerator, clashMetaGenerator, singboxGenerator, surgeGenerator, surgemacGenerator,
 egernGenerator, stashGenerator, surfboardGenerator, quantumultxGenerator, shadowrocketGenerator, loonGenerator, v2rayGenerator,
 v2rayUriGenerator, mixedGenerator, base64Generator, plainJsonGenerator
].forEach((g) => generators.set(g.id, g));

export function getGenerator(format: TargetFormat): Generator | undefined {
  return generators.get(format);
}

export function getAllFormats(): TargetFormat[] {
  return Array.from(generators.keys());
}
