import type { ComponentType } from 'react'
/** Application-owned contracts. This package does not authorize, persist, or execute privileged work. */
export type MaybePromise<T>=T|Promise<T>
export interface ActionContext {recordId?:string;selection?:string[];workspaceId?:string;[key:string]:unknown}
export interface ActionDefinition<TContext extends ActionContext=ActionContext>{id:string;label:string;description?:string;group?:string;icon?:string;shortcut?:string;dangerous?:boolean;isAvailable?:(context:TContext)=>boolean;run:(context:TContext)=>MaybePromise<void>}
export interface CommandDefinition<TContext extends ActionContext=ActionContext> extends ActionDefinition<TContext>{keywords?:string[]}
export interface PluginSlotDefinition<TProps=unknown>{id:string;owner:string;priority?:number;component:ComponentType<TProps>;isEnabled?:(context:ActionContext)=>boolean}
export interface Registry<T>{register(item:T):()=>void;get(id:string):T|undefined;list():T[];has(id:string):boolean}
function createRegistry<T extends {id:string}>(kind:string):Registry<T>{const items=new Map<string,T>();return {register(item){if(!item.id.trim())throw new Error(kind+' id must not be empty');if(items.has(item.id))throw new Error(kind+' already registered: '+item.id);items.set(item.id,item);return()=>{if(items.get(item.id)===item)items.delete(item.id)}},get:id=>items.get(id),list:()=>Array.from(items.values()),has:id=>items.has(id)}}
export function createActionRegistry<T extends ActionDefinition=ActionDefinition>():Registry<T>{return createRegistry<T>('Action')}
export function createCommandRegistry<T extends CommandDefinition=CommandDefinition>():Registry<T>{return createRegistry<T>('Command')}
export function createPluginSlotRegistry<T extends PluginSlotDefinition=PluginSlotDefinition>():Registry<T>{return createRegistry<T>('Plugin slot')}
export function sortPluginSlots<T extends PluginSlotDefinition>(slots:T[],context:ActionContext):T[]{return slots.filter(s=>s.isEnabled?.(context)??true).sort((a,b)=>(b.priority??0)-(a.priority??0))}
