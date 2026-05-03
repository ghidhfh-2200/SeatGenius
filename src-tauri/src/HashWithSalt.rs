use sha2::{Sha256, Digest};

const SALT: &str = "seatgeniussalt";

/// 对输入字符串进行加盐哈希，返回哈希后的十六进制字符串
pub fn hash_with_salt(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(SALT.as_bytes());
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_with_salt() {
        let hash1 = hash_with_salt("password123");
        let hash2 = hash_with_salt("password123");
        let hash3 = hash_with_salt("different");
        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }
}