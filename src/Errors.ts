/* eslint max-classes-per-file: 0 */

export class ObnizAppError extends Error {}

export class ObnizAppTimeoutError extends ObnizAppError {}

export class ObnizAppIdNotFoundError extends ObnizAppError {}

export class ObnizAppMasterSlaveCommunicationError extends ObnizAppError {}
