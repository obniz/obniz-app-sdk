
export const getObnizInfo = function (
  wsroom_id: string,
  obniz_id: string | number,
  callback: (err: Error | null, obniz: any) => void
) {
  callback(null, {
    id: obniz_id,
    metadata: {
      max_ws_clients: 1
    },
  });
};

 
export const checkAuthority = async (obj: {
  wsroom_id: string;
  obniz_id: number;
  authkey: string;
}) => {
  // logger.debug(`${wsroom_id} ${obniz_id} ${authkey}`);
  return {};
};
