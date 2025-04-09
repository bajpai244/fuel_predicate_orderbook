import type { Request, Response, RequestHandler } from 'express';
import type { WalletUnlocked } from 'fuels';

export type ExpressRequest = Request;
export type ExpressResponse = Response;
export type FuelWallet = WalletUnlocked;
export type RouteHandler = RequestHandler;
