"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function normName(n) { return n.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function levenshtein(a, b) {
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    var m = a.length, n = b.length;
    var dp = Array.from({ length: m + 1 }, function () { return new Array(n + 1).fill(0); });
    for (var i = 0; i <= m; i++)
        dp[i][0] = i;
    for (var j = 0; j <= n; j++)
        dp[0][j] = j;
    for (var i = 1; i <= m; i++)
        for (var j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}
function matchDoctor(providerName, index) {
    var target = normName(providerName);
    if (!target)
        return null;
    var bestEntry = null;
    var bestScore = Infinity;
    var hasSubstringMatch = false;
    for (var _i = 0, index_1 = index; _i < index_1.length; _i++) {
        var entry = index_1[_i];
        if (entry.normalised === target)
            return entry;
        if (entry.normalised.includes(target) || target.includes(entry.normalised)) {
            var dist = levenshtein(entry.normalised, target);
            if (dist < bestScore || !hasSubstringMatch) {
                bestScore = dist;
                bestEntry = entry;
                hasSubstringMatch = true;
            }
            continue;
        }
        if (!hasSubstringMatch) {
            var dist = levenshtein(entry.normalised, target);
            if (dist <= 3 && dist < bestScore) {
                bestScore = dist;
                bestEntry = entry;
            }
        }
    }
    return bestEntry;
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var blob, clinics, doctorIndex, _i, clinics_1, clinic, _a, _b, dept, _c, _d, doc, unmatched, updated, _e, unmatched_1, booking, match, e_1;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 7, 8, 10]);
                    return [4 /*yield*/, prisma.blobStore.findUnique({ where: { key: 'clinics' } })];
                case 1:
                    blob = _f.sent();
                    if (!blob)
                        return [2 /*return*/];
                    clinics = typeof blob.data === 'string' ? JSON.parse(blob.data) : blob.data;
                    doctorIndex = [];
                    for (_i = 0, clinics_1 = clinics; _i < clinics_1.length; _i++) {
                        clinic = clinics_1[_i];
                        for (_a = 0, _b = clinic.departments; _a < _b.length; _a++) {
                            dept = _b[_a];
                            for (_c = 0, _d = dept.doctors; _c < _d.length; _c++) {
                                doc = _d[_c];
                                doctorIndex.push({
                                    doctorId: doc.id,
                                    doctorName: doc.name,
                                    normalised: normName(doc.name),
                                    clinicId: clinic.id,
                                    deptId: dept.id
                                });
                            }
                        }
                    }
                    return [4 /*yield*/, prisma.booking.findMany({
                            where: { doctorId: 'sb-unmatched' },
                            select: { id: true, sbProviderName: true }
                        })];
                case 2:
                    unmatched = _f.sent();
                    console.log("Found ".concat(unmatched.length, " unmatched bookings"));
                    updated = 0;
                    _e = 0, unmatched_1 = unmatched;
                    _f.label = 3;
                case 3:
                    if (!(_e < unmatched_1.length)) return [3 /*break*/, 6];
                    booking = unmatched_1[_e];
                    if (!booking.sbProviderName)
                        return [3 /*break*/, 5];
                    match = matchDoctor(booking.sbProviderName, doctorIndex);
                    if (!match) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma.booking.update({
                            where: { id: booking.id },
                            data: {
                                doctorId: match.doctorId,
                                clinicId: match.clinicId,
                                deptId: match.deptId
                            }
                        })];
                case 4:
                    _f.sent();
                    updated++;
                    _f.label = 5;
                case 5:
                    _e++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log("Updated ".concat(updated, " bookings"));
                    return [3 /*break*/, 10];
                case 7:
                    e_1 = _f.sent();
                    console.error(e_1);
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, prisma.$disconnect()];
                case 9:
                    _f.sent();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
run();
