import { Installed_Device } from 'obniz-cloud-sdk/sdk';

export const deviceA: Installed_Device = {
  id: '7877-4454',
  access_token: null,
  description: '',
  metadata: '{}',
  devicekey: null,
  hardware: 'obnizb2',
  os: 'obnizb2',
  osVersion: '3.4.5',
  region: 'jp',
  status: 'active',
  createdAt: '2020-12-23T03:00:01.037Z',
  configs:
    '{"type":"gateway","values":[],"sensor_group_id":"5d961872-e9ed-4d3b-b5f0-0737417714ef"}',
  user: {
    id: 'usr_Mw==',
    name: 'kidof',
    email: 'koheikido@cambrianrobotics.com',
    picture:
      'https://s3-ap-northeast-1.amazonaws.com/obniz-uploads/dfcd65403be18f361602211642117',
    plan: 'biz',
    credit: '0',
    createdAt: '2018-02-28T19:43:19.191Z',
  },
  __typename: 'installed_device',
};
export const deviceB: Installed_Device = {
  id: '0883-8329',
  access_token: null,
  description: '',
  metadata: '{}',
  devicekey: '08838329&96cf5d88099444ae61a29356f71347f39977aef92bc3893f',
  hardware: 'esp32w',
  os: 'esp32w',
  osVersion: '2.1.1',
  region: 'jp',
  status: 'active',
  createdAt: '2020-09-06T02:54:31.978Z',
  configs:
    '{"type":"relay_gw","values":[],"sensor_group_id":"5d961872-e9ed-4d3b-b5f0-0737417714ef"}',
  user: {
    id: 'usr_Mw==',
    name: 'kidof',
    email: 'koheikido@cambrianrobotics.com',
    picture:
      'https://s3-ap-northeast-1.amazonaws.com/obniz-uploads/dfcd65403be18f361602211642117',
    plan: 'biz',
    credit: '0',
    createdAt: '2018-02-28T19:43:19.191Z',
  },
  __typename: 'installed_device',
};

export const deviceC: Installed_Device = {
  id: '8469-1805',
  access_token:
    '6MVmB37HkMaANQHnBAB9l67_NuXLpSHKJWn3Kc6vji9tQNT4zhj9bkMePN1FAEUs',
  description: 'ユーザーの要望により削除',
  hardware: 'esp32p',
  os: 'esp32w',
  devicekey: '84691805&30920268b090d64eab754583e937522f2783f9bf11bbe2af',
  metadata: '{"description":"ユーザー2236 の要望により削除"}',
  osVersion: '2.1.0',
  region: 'jp',
  status: 'inactive',
  createdAt: '2019-08-19T02:16:45.641Z',
  configs:
    '{"type":"relay_gw","values":[],"sensor_group_id":"5d961872-e9ed-4d3b-b5f0-0737417714ef"}',
  user: {
    id: 'usr_Mw==',
    name: 'kidof',
    email: 'koheikido@cambrianrobotics.com',
    picture:
      'https://s3-ap-northeast-1.amazonaws.com/obniz-uploads/dfcd65403be18f361602211642117',
    plan: 'biz',
    credit: '0',
    createdAt: '2018-02-28T19:43:19.191Z',
  },
  __typename: 'installed_device',
};
