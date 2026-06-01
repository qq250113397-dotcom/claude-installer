#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

export async function optimizePortablePackage(packageRoot, options = {}) {
  const dbPath = join(packageRoot, 'guiConfigs', 'guiNDB.db');
  const configPath = join(packageRoot, 'guiConfigs', 'guiNConfig.json');
  const minLatencyMs = Number(options.minLatencyMs || 400);
  const probeTimeoutMs = Number(options.probeTimeoutMs || 1200);
  const limit = Number(options.limit || 20);
  const dryRun = options.dryRun === true;

  const candidates = queryUsCandidates(dbPath, limit);
  if (!candidates.length) {
    return { selected: null, candidates: [] };
  }

  const measurements = [];
  for (const candidate of candidates) {
    const latency = await measureTcpLatency(candidate.address, candidate.port, probeTimeoutMs);
    measurements.push({ ...candidate, latency });
  }

  const usable = measurements.filter(item => Number.isFinite(item.latency) && item.latency >= 0);
  if (!usable.length) {
    return { selected: null, candidates: measurements };
  }

  usable.sort((a, b) => a.latency - b.latency);
  const selected = usable[0];

  if (!dryRun) {
    pruneDatabase(dbPath, selected.indexId);
    await writeSelectedState(configPath, selected);
  }

  return {
    selected,
    candidates: measurements,
    thresholdMet: selected.latency < minLatencyMs,
  };
}

function queryUsCandidates(dbPath, limit) {
  const sql = [
    "SELECT IndexId, Remarks, Address, Port, Subid",
    "FROM ProfileItem",
    "WHERE Remarks LIKE '%US%' OR Remarks LIKE '%美国%' OR Remarks LIKE '%USA%'",
    'ORDER BY Remarks ASC, IndexId ASC',
    `LIMIT ${Math.max(1, limit)}`,
  ].join(' ');

  const result = spawnSync('sqlite3', ['-batch', '-noheader', '-separator', '\t', dbPath, sql], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`sqlite3 query failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }

  const rows = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [indexId, remarks, address, port, subid] = line.split('\t');
      return {
        indexId: String(indexId || '').trim(),
        remarks: String(remarks || '').trim(),
        address: String(address || '').trim(),
        port: Number(port),
        subid: String(subid || '').trim(),
      };
    })
    .filter(row => row.indexId && row.address && Number.isFinite(row.port) && row.port > 0);

  return rows;
}

async function measureTcpLatency(host, port, timeoutMs) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const started = Date.now();
    let settled = false;

    const finish = value => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs, () => finish(null));
    socket.once('connect', () => finish(Date.now() - started));
    socket.once('error', () => finish(null));
  });
}

function pruneDatabase(dbPath, selectedIndexId) {
  const id = escapeSql(selectedIndexId);
  const sql = [
    'BEGIN;',
    `DELETE FROM ProfileItem WHERE IndexId <> '${id}';`,
    `DELETE FROM ProfileExItem WHERE IndexId <> '${id}';`,
    `DELETE FROM ServerStatItem WHERE IndexId <> '${id}';`,
    'COMMIT;',
  ].join(' ');
  const result = spawnSync('sqlite3', ['-batch', dbPath, sql], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`sqlite3 prune failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

async function writeSelectedState(configPath, selected) {
  const text = await readFile(configPath, 'utf8');
  const config = JSON.parse(text);
  config.IndexId = selected.indexId;
  if (selected.subid) {
    config.SubIndexId = selected.subid;
  }
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}
