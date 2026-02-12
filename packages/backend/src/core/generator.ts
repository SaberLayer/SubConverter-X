import { Generator, TargetFormat } from './types';
import { clashMetaGenerator } from '../generators/clash-meta';
import { singboxGenerator } from '../generators/singbox';
import { surgeGenerator } from '../generators/surge';
import { quantumultxGenerator } from '../generators/quantumultx';
import { shadowrocketGenerator } from '../generators/shadowrocket';
import { loonGenerator } from '../generators/loon';
import { v2rayGenerator } from '../generators/v2ray';
import { base64Generator } from '../generators/base64';

const generators: Map<TargetFormat, Generator> = new Map();

[clashMetaGenerator, singboxGenerator, surgeGenerator, quantumultxGenerator,
 shadowrocketGenerator, loonGenerator, v2rayGenerator, base64Generator
].forEach((g) => generators.set(g.id, g));

export function getGenerator(format: TargetFormat): Generator | undefined {
  return generators.get(format);
}

export function getAllFormats(): TargetFormat[] {
  return Array.from(generators.keys());
}
