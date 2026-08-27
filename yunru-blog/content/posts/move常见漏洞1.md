+++
title = 'move常见漏洞1'
date = 2025-04-27T16:22:46+08:00
draft = false
+++# 例1
```
public fun multiply(a : u8 , b : u8) : u8 {
	let result = a * b 
	result
}
```
a,b过大会导致overflow事件
修复建议
添加一个数据类型变更变为较大的数据类型防止溢出
```
public fun multiply(a : u8 , b : u8) : u64 {
	let result = (a as u64) * (b as u64);
	result
}
```
# 例2
```
public fun div(a : u8 , b : u8) : u8 {
	let result = a / b;
	result
}
```
注意到这里并没有确保除数不为0，因此不够安全
修复：
添加一个断言语句确保除数不为0
```
const VALUE_IS_ZERO: u64 = 1;
public fun div(a : u8 , b : u8) : u8 {
	assert!(b != 0 , VALUE_IS_ZERO);
	let result = a / b;
	result
}
```
# 例3
```
const NUMBER : u64 = 1_000_000_000;
const VALUE_IS_ZERO: u64 = 1;

public fun div(user_level : u8 , 
		     user_reward : u8 , 
		     user_punish : u64) : u64 {
	assert!(user_punish != 0 , VALUE_IS_ZERO);
	let result = ((user_level as u128) / 
			  (user_punish as u128) *
			  (user_reward as u64)) *
			  NUMBER
			  as u64;
	result
}
```
由于 move 的数据类型里不存在小数，且精度有上限，所以在user_level过小而user_punish过大时会导致数据归零也即result = user_level / user_punish = 0
修复建议
添加一个较大系数/合并多次运算保证除数不要过小
```
const NUMBER : u64 = 1_000_000_000;
const MAX_U64 : u64 = 18446744073709551615;

const VALUE_IS_ZERO: u64 = 1;
const EOVERFLOW: u64 = 2;

public fun div(user_level : u8 , 
		     user_reward : u8 , 
		     user_punish : u64) : u64 {
	assert!(user_punish != 0 , VALUE_IS_ZERO);
	let result_mul =  NUMBER *
			  ((user_level as u128) *
			  (user_reward as u64))
			  as u128;

	assert!(result_mul / (user_punish as u128) <= (MAX_U64 as u128) ,EOVERFLOW);

	(result_mul / user_punish) as u64
}
```

# 例4
```
public struct event has store,drop,copy{}
```
这个结构体是事件类型的结构体，不需要拥有store能力
修复建议
删除不需要的能力，关于这些能力应该怎么配置可以参考我的另一篇博客https://learnblockchain.cn/article/11506
```
public struct event has drop,copy{}
```


# 例5
```
    struct AdminCap has key, store { 
        id: UID 
    }
    struct PoolCreated has copy, drop {
        pool_id: ID,
        creator: address,
        unit_price: u64,
    }
    struct NFT has key , store {
        id: ID,
        creator: address,
        photo: string
    }
    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap {
            id: object::new(ctx)
        }, tx_context::sender(ctx));
    }
    public entry fun send_for _admin(
        NFT: &mut NFT,
        address: string
    ) {
      transfer::transfer(admin, address);
    }
```
该函数名表明其是管理员用的但是由于public 和entry 所有人都可以调用
修复：删除public 和entry
```
    struct AdminCap has key, store { 
        id: UID 
    }
    struct PoolCreated has copy, drop {
        pool_id: ID,
        creator: address,
        unit_price: u64,
    }
    struct NFT has key , store {
        id: ID,
        creator: address,
        photo: string
    }
    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap {
            id: object::new(ctx)
        }, tx_context::sender(ctx));
    }
    fun send_for _admin(
        NFT: &mut NFT,
        address: string
    ) {
      transfer::transfer(admin, address);
    }
```

