#!/usr/bin/env node
// AES-256 GCM 암호화 키 생성 (32 bytes base64)
import { randomBytes } from 'node:crypto';
console.log(randomBytes(32).toString('base64'));
