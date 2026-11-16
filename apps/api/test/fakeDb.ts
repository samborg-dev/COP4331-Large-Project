// A tiny in-memory stand-in for the MongoDB driver, enough for the queries the API
// makes. Lets the API tests run with no database, no network and no mongod download.
import { ObjectId } from 'mongodb';

type Doc = Record<string, any>;

const same = (a: unknown, b: unknown): boolean => {
  if (a instanceof ObjectId || b instanceof ObjectId) return String(a) === String(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
};

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
      if ('$gt' in cond) return value > cond.$gt;
      if ('$in' in cond) return (cond.$in as unknown[]).some((c) => same(value, c));
      if ('$regex' in cond) return new RegExp(cond.$regex, cond.$options ?? '').test(String(value));
    }
    return same(value, cond);
  });
}

class Cursor {
  constructor(private rows: Doc[]) {}
  sort(spec: Record<string, 1 | -1>) {
    this.rows = [...this.rows].sort((a, b) => {
      for (const [key, dir] of Object.entries(spec)) {
        if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * dir;
      }
      return 0;
    });
    return this;
  }
  skip(n: number) {
    this.rows = this.rows.slice(n);
    return this;
  }
  limit(n: number) {
    this.rows = this.rows.slice(0, n);
    return this;
  }
  async toArray() {
    return this.rows;
  }
}

class Collection {
  rows: Doc[] = [];

  async findOne(filter: Doc = {}) {
    return this.rows.find((r) => matches(r, filter)) ?? null;
  }
  find(filter: Doc = {}) {
    return new Cursor(this.rows.filter((r) => matches(r, filter)));
  }
  async countDocuments(filter: Doc = {}) {
    return this.rows.filter((r) => matches(r, filter)).length;
  }
  async insertOne(doc: Doc) {
    const _id = doc._id ?? new ObjectId();
    this.rows.push({ ...doc, _id });
    return { insertedId: _id };
  }
  async updateOne(filter: Doc, update: Doc) {
    const row = this.rows.find((r) => matches(r, filter));
    if (!row) return { matchedCount: 0, modifiedCount: 0 };
    Object.assign(row, update.$set ?? {});
    for (const [k, n] of Object.entries(update.$inc ?? {})) row[k] = (row[k] ?? 0) + (n as number);
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async replaceOne(filter: Doc, doc: Doc) {
    const i = this.rows.findIndex((r) => matches(r, filter));
    if (i === -1) return { matchedCount: 0, modifiedCount: 0 };
    this.rows[i] = { ...doc, _id: this.rows[i]!._id };
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async deleteMany(filter: Doc = {}) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r, filter));
    return { deletedCount: before - this.rows.length };
  }
  // The search route tries Atlas Search first and falls back to a scan when it throws
  aggregate(): never {
    throw new Error('$search is not available in the in-memory database');
  }
}

export class FakeDb {
  private collections = new Map<string, Collection>();

  collection(name: string): Collection {
    if (!this.collections.has(name)) this.collections.set(name, new Collection());
    return this.collections.get(name)!;
  }

  reset() {
    this.collections.clear();
  }
}
