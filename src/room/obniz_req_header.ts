import semver from 'semver';

export const parseHeader = (
  headers: { [key: string]: string },
  req: { [key: string]: any }
): { [key: string]: any } => {
  let os_version = headers['obniz-firmware-ver'];
  const local_ip = headers['obniz-local-ip'];
  const global_ip =
    headers['x-real-ip'] ||
    headers['x-forwarded-for'] ||
    req.connection.remoteAddress; // ngixnまたはherokuのforward。開発だとどっちもない。
  if (!os_version || !semver.valid(os_version)) {
    os_version = '1.0.0';
  }
  const wifi_mac_address = headers['obniz-device-wireless-mac'];
  const ether_mac_address = headers['obniz-device-wired-mac'];
  const plugin_key = headers['obniz-plugin-key'];

  let net: { [key: string]: any } | undefined;
  const net_header = headers['obniz-net'] as string;
  if (net_header) {
    const components = net_header.split('_');
    if (components.length > 0) {
      net = {};
      net.net = components.shift();
      for (const item of components) {
        const kv = item.split(':');
        if (kv.length < 2) {
          continue;
        }
        const key = kv[0];
        const value = kv[1];
        net[key] = value;
        if (key === 'root') {
          const isRootOfMeshNetwork = value === 'true';
          net[key] = isRootOfMeshNetwork;
        } else if (key === 'layer') {
          net[key] = parseInt(value);
        }
      }
    }
  }

  if (net && 'obniz-imsi' in headers) {
    if (typeof headers['obniz-csq'] === 'string') {
      if (headers['obniz-csq'].includes(',')) {
        // example 17,52 or 99,99,255,255,17,52
        const split = headers['obniz-csq'].split(',');
        if (split.length === 2) {
          const rssi = Number(split[0]);
          const ber = Number(split[1]);

          // BG96を元に定義
          if (
            isNaN(rssi) === false &&
            isNaN(ber) === false &&
            0 <= rssi &&
            rssi <= 199 &&
            0 <= ber &&
            ber <= 99
          ) {
            if (rssi !== 99 && rssi !== 199) {
              net.rssi = -113 + rssi * 2; // dBmに変換
            }

            if (ber !== 99) {
              net.ber = ber;
            }
          }
        } else if (split.length === 6) {
          // https://infocenter.nordicsemi.com/index.jsp?topic=%2Fref_at_commands%2FREF%2Fat_commands%2Fmob_termination_ctrl_status%2Fcsq.html
          let rsrq = Number(split[4]);
          let rsrp = Number(split[5]);
          if (!isNaN(rsrq) && rsrq !== 255) {
            rsrq = rsrq * 0.5 - 19.5;
            net.rsrq = rsrq;
          }
          if (!isNaN(rsrp) && rsrp !== 255) {
            rsrp = rsrp - 140;
            net.rsrp = rsrp; // −140 dBm ~ -44
            net.rssi = rsrp + 30; // -30to-80. This is not correct. we should consider rsrq and N.
          }
        }
      }
    }

    if (typeof headers['obniz-imsi'] === 'string') {
      const imsi = headers['obniz-imsi'];
      if (imsi.length === 15) {
        net.imsi = imsi;
      }
    }

    if (typeof headers['obniz-imei'] === 'string') {
      const imei = headers['obniz-imei'];
      if (imei.length === 15) {
        net.imei = imei;
      }
    }

    if (typeof headers['obniz-iccid'] === 'string') {
      const iccid = headers['obniz-iccid'];
      if (iccid.length === 19 || iccid.length === 20) {
        net.iccid = iccid;
      }
    }

    if (typeof headers['obniz-cnum'] === 'string') {
      const cnum = headers['obniz-cnum'];
      if (cnum.includes(',')) {
        const split = cnum.split(',');
        const index = split.length === 2 ? 0 : split.length === 3 ? 1 : null;
        if (index !== null) {
          const number = split[index].replace(/"/g, '');
          if (11 <= number.length && number.length <= 16) {
            net.cnum = number;
          }
        }
      }
    }
  }

  const obj: { [key: string]: any } = {
    os_version,
    local_ip,
    global_ip,
    wifi_mac_address,
    ether_mac_address,
    plugin_key,
  };
  if (net) {
    obj.net = net;
  }
  return obj;
};
