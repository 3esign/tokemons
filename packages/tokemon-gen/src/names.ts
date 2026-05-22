import { seedToInt } from '@tokemons/kernel';
import type { TokemonGenes } from './genes.js';
import { geneFingerprint } from './genes.js';

const SYL_A = [
  'ko', 'ra', 'mi', 'zu', 'ha', 'ne', 'pi', 'lu', 'ta', 'shi', 'yo', 'ki',
  'no', 'sa', 'te', 'mu', 'ri', 'ga', 'zo', 'chi', 'fu', 'wa', 'ei', 'ao',
];
const SYL_B = [
  'mon', 'ken', 'dex', 'mora', 'zuki', 'tama', 'gami', 'dera', 'mune', 'sura',
  'kaze', 'hane', 'ishi', 'kawa', 'yoru', 'hikari', 'kage', 'mado', 'tsuki',
];
const SYL_C = ['let', 'ix', 'ora', 'uin', 'eth', 'ax', 'eon', 'ara', 'ine', 'oss'];

const TRAIT_WORDS: Record<string, string[]> = {
  crystal: ['prism', 'facet', 'glass-heart'],
  blob: ['soft', 'mutable', 'dreaming'],
  insect: ['chitin', 'hive-mind', 'twitching'],
  avian: ['sky-born', 'feathered', 'keening'],
  fungal: ['spore', 'mycelial', 'glowing-cap'],
  serpent: ['coiled', 'sinuous', 'ancient'],
  floating: ['weightless', 'drifting', 'orbital'],
  plant: ['rooted', 'blossom', 'verdant'],
  biped: ['upright', 'watchful', 'stride'],
  quadruped: ['grounded', 'pack', 'steady'],
};

export function generateName(seed: number): string {
  const parts = 2 + (seedToInt(seed ^ 0xcc, 0, 1));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const chunks = [
    SYL_A[seedToInt(seed ^ 0xaa, 0, SYL_A.length - 1)]!,
    SYL_B[seedToInt(seed ^ 0xbb, 0, SYL_B.length - 1)]!,
  ];
  if (parts >= 3) chunks.push(SYL_C[seedToInt(seed ^ 0xdd, 0, SYL_C.length - 1)]!);
  return chunks.map(cap).join('');
}

export function generateDescription(genes: TokemonGenes): string {
  const traits = TRAIT_WORDS[genes.bodyPlan] ?? ['strange', 'wild'];
  const t = traits[seedToInt(genes.seed ^ 0xee, 0, traits.length - 1)]!;
  const asym =
    genes.symmetry === 'asymmetric' ? 'asymmetric form' : `${genes.symmetry} symmetry`;
  return `${t} ${genes.surface} being - ${genes.pattern} markings, ${genes.tailType} tail, ${asym}. id:${geneFingerprint(genes)}`;
}
