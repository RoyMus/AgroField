import { makeAutoObservable } from 'mobx';

const read = (key: string) => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
};

/** Replaces the old getData() module-globals + localStorage juggling. */
export class SettingsStore {
  isTemplate: boolean = read('isTemplate') ?? false;
  plant: string = read('plant') ?? '';
  grower: string = read('grower') ?? '';
  place: string = read('place') ?? '';
  faucetConductivity: string = read('faucet') ?? '';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  set<K extends 'isTemplate' | 'plant' | 'grower' | 'place' | 'faucetConductivity'>(key: K, value: this[K]) {
    this[key] = value;
    localStorage.setItem(
      key === 'faucetConductivity' ? 'faucet' : key,
      JSON.stringify(value)
    );
  }
}
