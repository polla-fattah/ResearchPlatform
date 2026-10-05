<?php

namespace App\Services;

class TotpService
{
    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /**
     * Generate a cryptographically secure Base32 secret (RFC 4648 / RFC 6238).
     */
    public static function generateSecret(int $length = 16): string
    {
        $alphabet = self::BASE32_ALPHABET;
        $secret = '';
        $bytes = random_bytes($length);

        for ($i = 0; $i < $length; $i++) {
            $secret .= $alphabet[ord($bytes[$i]) & 31];
        }

        return $secret;
    }

    /**
     * Decode a Base32 string to raw binary string.
     */
    public static function base32Decode(string $b32): string
    {
        $alphabet = self::BASE32_ALPHABET;
        $b32 = strtoupper(trim($b32));
        $buffer = 0;
        $bitsLeft = 0;
        $output = '';

        for ($i = 0; $i < strlen($b32); $i++) {
            $ch = $b32[$i];
            if ($ch === '=') {
                break;
            }
            $val = strpos($alphabet, $ch);
            if ($val === false) {
                continue;
            }

            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;

            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }

        return $output;
    }

    /**
     * Calculate 6-digit TOTP code for a specific timestamp (RFC 6238).
     */
    public static function getCode(string $secret, ?int $timestamp = null, int $digits = 6, int $period = 30): string
    {
        $timestamp = $timestamp ?? time();
        $timeSlice = (int) floor($timestamp / $period);

        // 8-byte big-endian packed counter (RFC 4226)
        $packedTime = pack('J', $timeSlice);

        $binaryKey = self::base32Decode($secret);
        $hash = hash_hmac('sha1', $packedTime, $binaryKey, true);

        // Dynamic truncation (RFC 4226 §5.4)
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $binary = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        );

        $otp = $binary % (10 ** $digits);

        return str_pad((string) $otp, $digits, '0', STR_PAD_LEFT);
    }

    /**
     * Alias for getCode to generate code for current timestamp.
     */
    public static function generateCode(string $secret, ?int $timestamp = null): string
    {
        return self::getCode($secret, $timestamp);
    }

    /**
     * Verify a 6-digit TOTP code within a window of steps (default ±1 step = ±30s).
     */
    public static function verify(string $secret, string $code, int $window = 1, ?int $timestamp = null): bool
    {
        $code = trim($code);
        if (strlen($code) !== 6 || !ctype_digit($code)) {
            return false;
        }

        $timestamp = $timestamp ?? time();
        $period = 30;

        for ($step = -$window; $step <= $window; $step++) {
            $calc = self::getCode($secret, $timestamp + ($step * $period));
            if (hash_equals($calc, $code)) {
                return true;
            }
        }

        return false;
    }
}
