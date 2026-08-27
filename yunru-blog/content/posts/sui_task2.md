+++
title = 'sui_task2'
date = 2024-11-11T16:22:46+08:00
draft = false
+++
# 看题目
## 1.提交两个package id
这个应该不用多说，就是在publish的时候把packageid给cv上去就好了
## 2.转账hash
然后这个转账hash其实把自己mint的那个交易hash放上去就是了(一开始我还以为要自己写一个transfer函数，还好看了其他人交的内容才没走弯路)
## 3.两个地址的mint_hash
就是找两个钱包然后调用mint函数并把hash值cv上去就好了
在sui浏览器查找这两次交易然后看到那个'Digest'就是我们需要的hash了

# 前置知识——所有权
sui中object的所有权有共享和被拥有两种情况
## 被拥有
被拥有的object即有唯一拥有者的object，可以以拥有者的身份分为两类——被地址拥有和被另一个object拥有
eg.
```
transfer(object, sender(ctx));
```
这段代码就是把一个object传递给发送请求的地址，也即将object变成被地址拥有的状态
被另一个object拥有的object还没有见识过，以后见到了再写一下
## 共享
共享可以理解为没有唯一的拥有者，共享类型分为两种，可变共享和不可变共享，从这个角度来看，已经发布在链上的packages和modules都是不可变的object(包括合约升级也不是改变这个object，所以确实不可变)
###区分
使用
```
    transfer::freeze_object(obj);
```
发布的对象是不可变共享对象

使用
```
    transfer::share_object(obj);
```
发布的对象是可变共享对象
# my_coin
## 思路 
需要一个自己可以铸造，别人不能铸造的coin,那显而易见的需要一个mint函数，如果要让别人无法mint，那么mint函数里面需要的参数应该要有一个只有自己拥有的参数，这里使用struct MY_COIN 来作为这个参数
在init时将MY_COIN包含在treasury_cap中，将treasury_cap传给发布者，就实现了只有发布者可以mint的coin合约
###核心代码
```
    fun init(witness: MY_COIN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<MY_COIN>(
            witness,
            2,
            b"MY_COIN",
            b"y_v",
            b"yunru-volknet",
            option::none(),
            ctx
        );

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }
```
## 完整代码 
```
module my_coin::my_coin {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    struct MY_COIN has drop {}

    fun init(witness: MY_COIN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<MY_COIN>(
            witness,
            2,
            b"MY_COIN",
            b"y_v",
            b"yunru-volknet",
            option::none(),
            ctx
        );

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    public fun mint(
        treasury_cap: &mut TreasuryCap<MY_COIN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx);
    }

    public fun burn(treasury_cap: &mut TreasuryCap<MY_COIN>, coin: Coin<MY_COIN>) {
        coin::burn(treasury_cap, coin);
    }

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(MY_COIN {}, ctx);
    }
}
```

# faucet_coin
## 思路 
基本思路和my_coin其实差别不大，比较重要的区别是faucet_coin是所有人都可以进行mint操作的，所以在这个合约里面需要实现让所有人都可以调用mint,也就是让所有人都可以访问到那个witness对象，这样就需要考虑到权限控制问题

也就是让witness对象变成public类型，这样就所有人都可以访问了(让我访问！！！)
然后就是题目要求要有两个地址进行mint操作，则把mint函数的类型改成entry函数会比较方便，可以直接在suiscan调用这个函数(只是为了方便，非必要)

### 核心代码
权限控制，使用public_share_object实现把treasury_cap变成一个所有人都可以调用的对象，从而所有人都可以mint自己的faucet_coin
```
    fun init(witness: FAUCET_COIN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<FAUCET_COIN>(
            witness, 
            2, 
            b"yunru-volknet", 
            b"y_v's faucet coin", 
            b"y_v's faucet coin", 
            option::none(), 
            ctx
        );
        transfer::public_freeze_object(metadata);
        // transfer::public_transfer(treasury_cap, tx_context::sender(ctx))
        transfer::public_share_object(treasury_cap)
    }
```
entry fun 语法和普通函数一致，只是多了一个entry关键字，可以直接在sui浏览器中调用，非常方便
```
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<FAUCET_COIN>, amount: u64, recipient: address, ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx)
    }
```

## 完整代码 
```
module faucet_coin::faucet_coin {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    public struct FAUCET_COIN has drop {}

    fun init(witness: FAUCET_COIN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<FAUCET_COIN>(
            witness, 
            2, 
            b"yunru-volknet", 
            b"y_v's faucet coin", 
            b"y_v's faucet coin", 
            option::none(), 
            ctx
        );
        transfer::public_freeze_object(metadata);
        // transfer::public_transfer(treasury_cap, tx_context::sender(ctx))
        transfer::public_share_object(treasury_cap)
    }

    public entry fun mint(
        treasury_cap: &mut TreasuryCap<FAUCET_COIN>, amount: u64, recipient: address, ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx)
    }

    public fun burn(treasury_cap: &mut TreasuryCap<FAUCET_COIN>, coin: Coin<FAUCET_COIN>) {
        coin::burn(treasury_cap, coin);
    }

}
```

# 参考文章

