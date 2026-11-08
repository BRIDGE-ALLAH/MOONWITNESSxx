export interface DivineContext {
 readonly actor?:{readonly id:string;readonly role?:string};
 readonly capabilities:readonly string[]; readonly locale:string;
 readonly researchScope?:Readonly<Record<string,unknown>>; readonly traceId:string;
 readonly methods:ReadonlyMap<string,unknown>; readonly adapters:Readonly<Record<string,unknown>>;
}
export interface AddonDependency {readonly id:string;readonly version?:string}
export interface AddonManifest {
 readonly id:string; readonly version:string; readonly dependencies?:readonly AddonDependency[];
 readonly capabilities?:readonly string[]; readonly models?:readonly string[];
 readonly services?:readonly string[]; readonly hooks?:readonly string[];
 readonly compatibility?:{readonly divine?:string};
}
export interface DivineAddon {
 readonly manifest:AddonManifest;
 initialize?(context:DivineContext):void|Promise<void>;
 dispose?(context:DivineContext):void|Promise<void>;
}
export interface ResolvedAddonGraph {
 readonly ordered:readonly DivineAddon[];
 readonly capabilities:ReadonlyMap<string,readonly string[]>;
 readonly services:ReadonlyMap<string,string>;
}
export interface DivineRuntime {
 readonly context:DivineContext; readonly addons:readonly DivineAddon[];
 readonly state:"active"|"disposed"; dispose():Promise<void>;
}