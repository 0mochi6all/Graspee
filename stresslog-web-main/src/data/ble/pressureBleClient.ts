/// <reference types="web-bluetooth" />
import {
  DEVICE_NAME,
  parsePressureSample,
  PRESSURE_CHARACTERISTIC_UUID,
  PRESSURE_SERVICE_UUID,
  type PressureSample,
} from './pressureBleSpec';

// Android版 data/ble/PressureBleClient.kt の移植。
// Webではスキャンの代わりにブラウザのデバイス選択ダイアログ（chooser）が出るため、
// Scanning は Choosing に読み替えている

export type PressureConnectionState =
  | { status: 'idle' }
  | { status: 'unsupported' }
  | { status: 'choosing' }
  | { status: 'connecting'; deviceName: string | null }
  | { status: 'connected'; deviceName: string | null }
  | { status: 'disconnected' }
  | { status: 'error'; message: string };

const MAX_RECENT_SAMPLES = 100;

interface ClientSnapshot {
  connectionState: PressureConnectionState;
  latestSample: PressureSample | null;
  /** 直近の rawAdc（波形表示用リングバッファ、最大100件） */
  recentRawAdc: number[];
}

let snapshot: ClientSnapshot = {
  connectionState: { status: 'idle' },
  latestSample: null,
  recentRawAdc: [],
};

const listeners = new Set<() => void>();

function emit(partial: Partial<ClientSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  listeners.forEach((l) => l());
}

export function getBleSnapshot(): ClientSnapshot {
  return snapshot;
}

export function subscribeBle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

let device: BluetoothDevice | null = null;
let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

function onCharacteristicValueChanged(event: Event) {
  const target = event.target as BluetoothRemoteGATTCharacteristic;
  const sample = parsePressureSample(target.value ?? undefined);
  if (!sample) return;
  const recent = [...snapshot.recentRawAdc, sample.rawAdc];
  if (recent.length > MAX_RECENT_SAMPLES) recent.splice(0, recent.length - MAX_RECENT_SAMPLES);
  emit({ latestSample: sample, recentRawAdc: recent });
}

function onGattDisconnected() {
  cleanup();
  emit({ connectionState: { status: 'disconnected' } });
}

function cleanup() {
  if (characteristic) {
    characteristic.removeEventListener('characteristicvaluechanged', onCharacteristicValueChanged);
    characteristic = null;
  }
  if (device) {
    device.removeEventListener('gattserverdisconnected', onGattDisconnected);
  }
}

/** デバイス選択ダイアログを出して接続し、notify購読を開始する */
export async function connectPressureSensor(): Promise<void> {
  if (!bluetoothSupported()) {
    emit({ connectionState: { status: 'unsupported' } });
    return;
  }

  emit({ connectionState: { status: 'choosing' } });
  try {
    const chosen = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: DEVICE_NAME }],
      // 128bitカスタムUUIDはここに列挙しないと getPrimaryService できない
      optionalServices: [PRESSURE_SERVICE_UUID],
    });

    device = chosen;
    emit({ connectionState: { status: 'connecting', deviceName: chosen.name ?? null } });

    chosen.addEventListener('gattserverdisconnected', onGattDisconnected);

    const gatt = await chosen.gatt!.connect();
    const service = await gatt.getPrimaryService(PRESSURE_SERVICE_UUID);
    characteristic = await service.getCharacteristic(PRESSURE_CHARACTERISTIC_UUID);
    characteristic.addEventListener('characteristicvaluechanged', onCharacteristicValueChanged);
    await characteristic.startNotifications();

    emit({
      connectionState: { status: 'connected', deviceName: chosen.name ?? null },
      latestSample: null,
      recentRawAdc: [],
    });
  } catch (e) {
    cleanup();
    if (e instanceof DOMException && e.name === 'NotFoundError') {
      // ユーザーがデバイス選択をキャンセルした場合はエラー扱いにしない
      emit({ connectionState: { status: 'idle' } });
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    emit({ connectionState: { status: 'error', message: `接続に失敗しました: ${message}` } });
  }
}

export function disconnectPressureSensor() {
  const gatt = device?.gatt;
  cleanup();
  if (gatt?.connected) {
    gatt.disconnect(); // gattserverdisconnected は購読解除済みなので自前で状態を更新する
  }
  device = null;
  emit({ connectionState: { status: 'idle' } });
}
