LOGS FRONT NAVEGADOR:
[useExtratoPaginado] 📄 Página 1: primeira página (sem marker)
useExtratoPaginado.ts:217  GET https://api-bank.gruponexus.com.br/api/bitso/pix/extrato/conta?limit=200&page=1&order=desc&sort=timestamp&sort_by=date&order_by=created_at 400 (Bad Request)
buscarPagina @ useExtratoPaginado.ts:217
queryFn @ useExtratoPaginado.ts:526
fetchFn @ @tanstack_react-query.js?v=26b0c351:881
run @ @tanstack_react-query.js?v=26b0c351:513
(anonymous) @ @tanstack_react-query.js?v=26b0c351:538
Promise.then
(anonymous) @ @tanstack_react-query.js?v=26b0c351:534
Promise.catch
run @ @tanstack_react-query.js?v=26b0c351:517
start @ @tanstack_react-query.js?v=26b0c351:555
fetch @ @tanstack_react-query.js?v=26b0c351:969
executeFetch_fn @ @tanstack_react-query.js?v=26b0c351:2280
setOptions @ @tanstack_react-query.js?v=26b0c351:2040
(anonymous) @ @tanstack_react-query.js?v=26b0c351:3157
commitHookEffectListMount @ chunk-T2SWDQEL.js?v=26b0c351:16915
commitPassiveMountOnFiber @ chunk-T2SWDQEL.js?v=26b0c351:18156
commitPassiveMountEffects_complete @ chunk-T2SWDQEL.js?v=26b0c351:18129
commitPassiveMountEffects_begin @ chunk-T2SWDQEL.js?v=26b0c351:18119
commitPassiveMountEffects @ chunk-T2SWDQEL.js?v=26b0c351:18109
flushPassiveEffectsImpl @ chunk-T2SWDQEL.js?v=26b0c351:19490
flushPassiveEffects @ chunk-T2SWDQEL.js?v=26b0c351:19447
performSyncWorkOnRoot @ chunk-T2SWDQEL.js?v=26b0c351:18868
flushSyncCallbacks @ chunk-T2SWDQEL.js?v=26b0c351:9119
commitRootImpl @ chunk-T2SWDQEL.js?v=26b0c351:19432
commitRoot @ chunk-T2SWDQEL.js?v=26b0c351:19277
finishConcurrentRender @ chunk-T2SWDQEL.js?v=26b0c351:18805
performConcurrentWorkOnRoot @ chunk-T2SWDQEL.js?v=26b0c351:18718
workLoop @ chunk-T2SWDQEL.js?v=26b0c351:197
flushWork @ chunk-T2SWDQEL.js?v=26b0c351:176
performWorkUntilDeadline @ chunk-T2SWDQEL.js?v=26b0c351:384
r @ inpage.js:227
t @ inpage.js:227
V @ inpage.js:227
postMessage
i @ inpage.js:227
e @ inpage.js:227
schedulePerformWorkUntilDeadline @ chunk-T2SWDQEL.js?v=26b0c351:400
requestHostCallback @ chunk-T2SWDQEL.js?v=26b0c351:418
unstable_scheduleCallback @ chunk-T2SWDQEL.js?v=26b0c351:330
scheduleCallback$1 @ chunk-T2SWDQEL.js?v=26b0c351:19826
ensureRootIsScheduled @ chunk-T2SWDQEL.js?v=26b0c351:18652
scheduleUpdateOnFiber @ chunk-T2SWDQEL.js?v=26b0c351:18562
dispatchSetState @ chunk-T2SWDQEL.js?v=26b0c351:12403
updateFeatures @ useBankFeatures.ts:133
(anonymous) @ useBankFeatures.ts:170
setInterval
(anonymous) @ useBankFeatures.ts:169
commitHookEffectListMount @ chunk-T2SWDQEL.js?v=26b0c351:16915
invokePassiveEffectMountInDEV @ chunk-T2SWDQEL.js?v=26b0c351:18324
invokeEffectsInDev @ chunk-T2SWDQEL.js?v=26b0c351:19701
commitDoubleInvokeEffectsInDEV @ chunk-T2SWDQEL.js?v=26b0c351:19686
flushPassiveEffectsImpl @ chunk-T2SWDQEL.js?v=26b0c351:19503
flushPassiveEffects @ chunk-T2SWDQEL.js?v=26b0c351:19447
commitRootImpl @ chunk-T2SWDQEL.js?v=26b0c351:19416
commitRoot @ chunk-T2SWDQEL.js?v=26b0c351:19277
performSyncWorkOnRoot @ chunk-T2SWDQEL.js?v=26b0c351:18895
flushSyncCallbacks @ chunk-T2SWDQEL.js?v=26b0c351:9119
(anonymous) @ chunk-T2SWDQEL.js?v=26b0c351:18627Understand this error
ExtractTable.tsx:94 [ExtractTable] Erro no carregamento: Error: BITSO API Error: Bad Request
    at buscarPagina (useExtratoPaginado.ts:230:11)



LOGS BACKEND:
offset: 7700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 78 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 82: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 83 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 78: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 7800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 79 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 83: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 84 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 79: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 7900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 80 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 80: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 81 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 84: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 85 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 81: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 82 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 85: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 86 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 82: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 83 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 86: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 87 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 83: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 84 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 87: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 88 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 88: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 89 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 84: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 85 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 89: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 8900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 90 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 85: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 86 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 90: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 91 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 86: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 87 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 91: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 92 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 87: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 88 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 92: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 93 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 88: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 89 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 93: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 94 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 89: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 8900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 90 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 94: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 95 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 90: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 91 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 95: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 96 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 91: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 92 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 96: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 97 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 92: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 93 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 97: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 98 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 93: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 94 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 98: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 99 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 94: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 95 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 99: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 9900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 100 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 95: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 96 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 96: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 97 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 100: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 101 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 101: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 102 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 97: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 98 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 102: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 103 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 98: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 99 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 103: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 104 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 99: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 9900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 100 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 104: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 105 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 100: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 101 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 105: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 106 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 101: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 102 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 106: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 107 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 102: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 103 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 107: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 108 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 108: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 109 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 103: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 104 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 104: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 105 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 109: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 10900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 110 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 110: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 111 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 105: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 106 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 111: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 112 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 106: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 107 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 112: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 113 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 107: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 108 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 108: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 109 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 113: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 114 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 114: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 115 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 109: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 10900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 110 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 115: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 116 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 110: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 111 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 116: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 117 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 111: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 112 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 117: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 118 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 112: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 113 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 118: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 119 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 113: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 114 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 119: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 11900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 120 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 114: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 115 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 120: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 121 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 115: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 116 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 121: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 122 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 116: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 117 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 122: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 123 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 117: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 118 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 123: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 124 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 118: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 119 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 124: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 125 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 119: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 11900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 120 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 125: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 126 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 120: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 121 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 126: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 127 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 121: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 122 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 127: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 128 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 122: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 123 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 128: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 129 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 123: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 124 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 129: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 12900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 130 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 124: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 125 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 130: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 131 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 125: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 126 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 131: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 132 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 132: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 133 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 126: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 127 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 127: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 128 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 133: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 134 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 128: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 129 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 134: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 135 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 135: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 136 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 129: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 12900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 130 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 136: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 137 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 130: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 131 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 137: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 138 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 131: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 132 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 138: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 139 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 132: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 133 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 139: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 13900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 140 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 133: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 134 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 140: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 141 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 134: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 135 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 141: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 142 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 135: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 136 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 142: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 143 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 136: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 137 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 137: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 138 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 143: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 144 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 138: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 139 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 144: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 145 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 139: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 13900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 140 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 145: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 146 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 140: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 141 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 146: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 147 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 141: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 142 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 147: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 148 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 142: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 143 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 148: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 149 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 143: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 144 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 149: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 14900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 150 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 144: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 145 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 150: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 151 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 145: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 146 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 151: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 152 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 146: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 147 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 152: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15200
1|baas-server  | [BITSO-PIX] 📄 Buscando página 153 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 147: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 148 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 153: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15300
1|baas-server  | [BITSO-PIX] 📄 Buscando página 154 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 148: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14800
1|baas-server  | [BITSO-PIX] 📄 Buscando página 149 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 154: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15400
1|baas-server  | [BITSO-PIX] 📄 Buscando página 155 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 149: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 14900
1|baas-server  | [BITSO-PIX] 📄 Buscando página 150 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 155: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15500
1|baas-server  | [BITSO-PIX] 📄 Buscando página 156 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 150: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 15000
1|baas-server  | [BITSO-PIX] 📄 Buscando página 151 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 156: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15600
1|baas-server  | [BITSO-PIX] 📄 Buscando página 157 de pay-ins...
1|baas-server  | [BITSO-PIX] ✅ Página 151: 100 pay-outs encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-outs: Sem marker, usando offset: 15100
1|baas-server  | [BITSO-PIX] 📄 Buscando página 152 de pay-outs...
1|baas-server  | [BITSO-PIX] ✅ Página 157: 100 pay-ins encontrados
1|baas-server  | [BITSO-PIX] 🔄 Pay-ins: Sem marker, usando offset: 15700
1|baas-server  | [BITSO-PIX] 📄 Buscando página 158 de pay-ins...
1|baas-server  | [Bitso HTTP] ❌ Erro na tentativa 1: {
1|baas-server  |   method: 'GET',
1|baas-server  |   endpoint: '/fundings',
1|baas-server  |   status: 400,
1|baas-server  |   statusText: 'Bad Request',
1|baas-server  |   message: 'Request failed with status code 400',
1|baas-server  |   responseData: '{\n' +
1|baas-server  |     '  "success": false,\n' +
1|baas-server  |     '  "error": {\n' +
1|baas-server  |     '    "message": "Too many requests.",\n' +
1|baas-server  |     '    "code": "200",\n' +
1|baas-server  |     '    "details": [],\n' +
1|baas-server  |     '    "error_data": null\n' +
1|baas-server  |     '  }\n' +
1|baas-server  |     '}'
1|baas-server  | }
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-ins: Bitso API Error [400]: Too many requests.
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-ins completo: Bitso API Error [400]: Too many requests.
1|baas-server  | [BITSO-PIX] Erro ao consultar extrato: Bitso API Error [400]: Too many requests.
1|baas-server  | [Bitso HTTP] ❌ Erro na tentativa 1: {
1|baas-server  |   method: 'GET',
1|baas-server  |   endpoint: '/withdrawals',
1|baas-server  |   status: 400,
1|baas-server  |   statusText: 'Bad Request',
1|baas-server  |   message: 'Request failed with status code 400',
1|baas-server  |   responseData: '{\n' +
1|baas-server  |     '  "success": false,\n' +
1|baas-server  |     '  "error": {\n' +
1|baas-server  |     '    "message": "Too many requests.",\n' +
1|baas-server  |     '    "code": "200",\n' +
1|baas-server  |     '    "details": [],\n' +
1|baas-server  |     '    "errorData": null\n' +
1|baas-server  |     '  }\n' +
1|baas-server  |     '}'
1|baas-server  | }
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-outs: Bitso API Error [400]: Too many requests.
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-outs completo: Bitso API Error [400]: Too many requests.
1|baas-server  | [BITSO-PIX] 📋 Consultando extrato - Nova abordagem (busca completa + paginação backend)
1|baas-server  | [BITSO-PIX] 📄 Página solicitada: 1 (200 registros por página)
1|baas-server  | [BITSO-PIX] 🔍 Buscando TODOS os registros com filtros: { limit: 100, sort: 'desc' }
1|baas-server  | [BITSO-PIX] 📥 Iniciando busca completa de pay-ins (limite por página: 100)
1|baas-server  | [BITSO-PIX] 📄 Buscando página 1 de pay-ins...
1|baas-server  | [BITSO-PIX] 📤 Iniciando busca completa de pay-outs (limite por página: 100)
1|baas-server  | [BITSO-PIX] 📄 Buscando página 1 de pay-outs...
1|baas-server  | [Bitso HTTP] ❌ Erro na tentativa 1: {
1|baas-server  |   method: 'GET',
1|baas-server  |   endpoint: '/withdrawals',
1|baas-server  |   status: 400,
1|baas-server  |   statusText: 'Bad Request',
1|baas-server  |   message: 'Request failed with status code 400',
1|baas-server  |   responseData: '{\n' +
1|baas-server  |     '  "success": false,\n' +
1|baas-server  |     '  "error": {\n' +
1|baas-server  |     '    "message": "Too many requests.",\n' +
1|baas-server  |     '    "code": "200",\n' +
1|baas-server  |     '    "details": [],\n' +
1|baas-server  |     '    "errorData": null\n' +
1|baas-server  |     '  }\n' +
1|baas-server  |     '}'
1|baas-server  | }
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-outs: Bitso API Error [400]: Too many requests.
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-outs completo: Bitso API Error [400]: Too many requests.
1|baas-server  | [BITSO-PIX] Erro ao consultar extrato: Bitso API Error [400]: Too many requests.
1|baas-server  | [Bitso HTTP] ❌ Erro na tentativa 1: {
1|baas-server  |   method: 'GET',
1|baas-server  |   endpoint: '/fundings',
1|baas-server  |   status: 400,
1|baas-server  |   statusText: 'Bad Request',
1|baas-server  |   message: 'Request failed with status code 400',
1|baas-server  |   responseData: '{\n' +
1|baas-server  |     '  "success": false,\n' +
1|baas-server  |     '  "error": {\n' +
1|baas-server  |     '    "message": "Too many requests.",\n' +
1|baas-server  |     '    "code": "200",\n' +
1|baas-server  |     '    "details": [],\n' +
1|baas-server  |     '    "error_data": null\n' +
1|baas-server  |     '  }\n' +
1|baas-server  |     '}'
1|baas-server  | }
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-ins: Bitso API Error [400]: Too many requests.
1|baas-server  | [BITSO-PIX] Erro ao consultar pay-ins completo: Bitso API Error [400]: Too many requests.

