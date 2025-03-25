import type { ScriptRequest, ScriptTransactionRequest } from "fuels";
import {z} from "zod"

const txPointerSchema = z.literal('0x00000000000000000000000000000000');

export const InputCoinSchema = z.object({
    id: z.string().startsWith('0x'),
    type: z.literal(0),
    owner: z.string().startsWith('0x'),
    amount: z.string().startsWith('0x'),
    assetId: z.string().startsWith('0x'),
    txPointer: txPointerSchema,
    witnessIndex: z.number(),
  });
  
  export const InputContractSchema = z.object({
    type: z.literal(1),
    contractId: z.string().startsWith('0x'),
    txPointer: txPointerSchema,
  });
  
  // currently only supports coin and contract inputs, but we may want to add more in the future
  const InputsSchema = InputCoinSchema.or(InputContractSchema);
  
  export const OutputCoinSchema = z.object({
    type: z.literal(0),
    to: z.string().startsWith('0x'),
    amount: z.string().startsWith('0x').or(z.number()),
    assetId: z.string().startsWith('0x'),
  });
  
  export const OutputContractSchema = z.object({
    type: z.literal(1),
    inputIndex: z.number(),
  });
  
  export const OutputChangeSchema = z.object({
    type: z.literal(2),
    to: z.string().startsWith('0x'),
    assetId: z.string().startsWith('0x'),
  });
  
  export const OutputVariableSchema = z.object({
    type: z.literal(3),
  });
  
  // currently only supports coin and change outputs, but we may want to add more in the future
  export const OutputsSchema = OutputCoinSchema.or(OutputContractSchema)
    .or(OutputChangeSchema)
    .or(OutputVariableSchema);

export const ScriptRequestSchema = z.object({
    maxFee: z.string().startsWith('0x'),
    inputs: z.array(InputsSchema),
    outputs: z.array(OutputsSchema),
    witnesses: z.array(z.string().startsWith('0x')),
    type: z.literal(0),
    gasLimit: z.string().startsWith('0x'),
    script: z.string().startsWith('0x'),
    scriptData: z.string().startsWith('0x'),
  });

  export const setRequestFields = (
    request: ScriptTransactionRequest,
    scriptRequest: ScriptRequest
  ) => {
    if(scriptRequest.type) {
      request.type = scriptRequest.type;
    }
  
    // TODO: do explicit type conversion to remove the ts-ignore
    // we are ts-ignoring, because even with different types, it still works
    // @ts-ignore
    if(scriptRequest.gasLimit) {
      request.gasLimit = scriptRequest.gasLimit;
    }
    // @ts-ignore
    if(scriptRequest.script) {
      request.script = scriptRequest.script;
    }
    // @ts-ignore
    if(scriptRequest.scriptData) {
      request.scriptData = scriptRequest.scriptData;
    }
    // @ts-ignore
    if(scriptRequest.maxFee) {
      request.maxFee = scriptRequest.maxFee;
    }
  
    if(scriptRequest.inputs) {
      request.inputs = scriptRequest.inputs;
    }
    if(scriptRequest.outputs) {
      request.outputs = scriptRequest.outputs;
    }
    if(scriptRequest.witnesses) {
      request.witnesses = scriptRequest.witnesses;
    }
  };
