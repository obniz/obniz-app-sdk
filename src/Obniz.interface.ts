export interface IObnizOptions {
  binary?: boolean;
  local_connect?: boolean;
  debug_dom_id?: string;
  auto_connect?: boolean;
  access_token?: string | null;
  obniz_server?: string;
  reset_obniz_on_ws_disconnection?: boolean;
  obnizid_dialog?: boolean;
}

export interface IObniz {
  onconnect?: (obniz: any) => Promise<void> | void;
  onloop?: (obniz: any) => Promise<void> | void;
  onclose?: (obniz: any) => Promise<void> | void;
  closeWait: () => Promise<void>;
  connect: () => void;
  autoConnect: boolean;
}

export interface IObnizStatic<O> {
  new (obnizId: string, options: IObnizOptions): O;

  version: string;
}
