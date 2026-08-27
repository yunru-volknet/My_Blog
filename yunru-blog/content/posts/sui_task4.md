+++
title = 'sui_task4'
date = 2024-11-20T16:22:46+08:00
draft = false
+++
# 看题目
game package id :
这个上上期讲过了
## deposit Coin hash:
存款hash，所以需要一个存款方法
## withdraw `Coin` hash:
提款hash，所以需要一个提款方法
## play game hash:
就是client交互合约的hash(没有play函数怎么办?写喽，难道有一种游戏是可以看但是不能玩的?)

## 结论
需要做的game需要有存款，提款，play_game三个功能，然后既然有存款和提款，那玩游戏时也可以有一个赢了得到coin，输了失去coin的逻辑
如果有这么一个功能的话那就需要一个资金池实现赢了从池子里提钱，输了把钱传进池子里，存款和提款也一起在这个资金池实现

# 前置知识
balance和coin的区别
在sui里面coin是一种对象，不止有面额还有一个id,balance只有面额没有id，可以看作coin是纸币，然后balance是账本上的数额(支付宝的数字)，在存钱的时候用balance就不用存储多一个id的值，应该能减少一些存储成本
存钱时可以使用

# game
## 思路
这个task就分为两个部分一个是游戏逻辑，另一个是代币存取
个人感觉难点在于如何实现代币的存取
### 游戏思路
这里选择了最古老的游戏模式之一——剪刀石头布
分别以0，1，2代指石头,剪刀,布(本来应该是5，2，0代指布，剪刀，石头的，但是我忘记了QAQ)
所以就在看电脑随机的选择和自己的选择，如果赢了就reward，输了就失去代币
```
public entry fun Play(game: &mut Game, rnd: &Random, choice: u8, coin: &mut Coin<FAUCET_COIN>, amount: u64, ctx: &mut TxContext) {
        assert!(game.balance.value() >= amount, EGameInsufficientBalance);
        assert!(coin.value() >= amount, EUserInsufficientBalance);

        let mut rand = random::new_generator(rnd, ctx);    
        let ComputerChoice = random::generate_u8(&mut rand) % 3;

        if (
            (choice == 0 && ComputerChoice == 1)
            || (choice == 1 && ComputerChoice == 2)
            || (choice == 2 && ComputerChoice == 0)
        ) {
            //win,you will get reward
            let reward = coin::take(&mut game.balance, amount, ctx);
            coin.join(reward);
        } else if (choice == ComputerChoice) {
            //draw,nothing happen
        } else {
            //lose,lose your coin
            Self::deposit(game, coin, amount,ctx)
        };
    }
```
然后获胜的奖励和失败的惩罚也放在下面代币存取一块说(平局最简单，直接无事发生就好了)
### faucet_coin存取
这里就得学习一下官方文档了
官方文档的链接(使用到的函数的源码都复制在下面了)
https://docs.sui.io/references/framework/sui-framework/balance
https://docs.sui.io/references/framework/sui-framework/coin

这里选择了把coin存为balance，然后取出coin的时候再生成一个新的coin
#### 所用到的一些函数
```
/**调用*/
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
```
分离balance使用
balance::split
```
public fun split<T>(self: &mut Balance<T>, value: u64): Balance<T> {
    assert!(self.value >= value, ENotEnough);
    self.value = self.value - value;
    Balance { value }
}
//self参数是传入的代币，这个函数可从self分离出一个值为value数额的balance
```
传balance使用
balance::join
```
public fun join<T>(self: &mut Balance<T>, balance: Balance<T>): u64 {
    let Balance { value } = balance;
    self.value = self.value + value;
    self.value
}
```
生成coin使用
coin::take
```
public fun take<T>(balance: &mut Balance<T>, value: u64, ctx: &mut TxContext): Coin<T> {
    Coin {
        id: object::new(ctx),
        balance: balance.split(value),
    }
}
//取出balance并生成一个id组合成一个 coin对象
```
奖励coin对象使用
coin::join
```
public entry fun join<T>(self: &mut Coin<T>, c: Coin<T>) {
    let Coin { id, balance } = c;
    id.delete();
    self.balance.join(balance);
}
/**
注意：这里看同时传入self和c两个参数也就是把它id删除然后把balance传入到参数给出的coin对象的balance字段里面，也就是说coin的个数是没有增加的，但是面额变大了，老师说在合并对象时会返还一定的gas费，也就是说官方是乐意推动合并对象的，可能是因为减少了存储成本？有了解原因的大佬可以指导一下，感激不尽
*/
/**
那到底怎么实现奖励coin呢？可以回去看一下我的task2文章有写到权限控制的一点知识点，这里是保证self对象是玩家私有的，在这种情况下joiin函数就能实现self对象的balance值增加，然后再结束游戏，这样就实现了奖励coin
*/
```
综上
deposit使用balance::split和balance::join来实现
withdraw使用coin::take和transfer实现
最后获胜奖励函数用coin::take和coin::join实现
然后失败的惩罚用deposit就好了，可复用性拉满了
平局不用说吧？无事发生啦

# 完整代码
```
module game_520::rock_paper_scissors {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::random::{Self, Random};
    use faucet_coin::faucet_coin::FAUCET_COIN;

    const EUserInsufficientBalance: u64 = 1000;
    const EGameInsufficientBalance: u64 = 1001;


    public struct Game has key {
        id: UID,
        balance: Balance<FAUCET_COIN>,
        game_name:vector<u8>
    }

    public struct Admin has key {
        id: UID,
    }

    fun init(ctx: &mut TxContext){
        // create game and share it
        let game = Game{
            id: object::new(ctx),
            balance: balance::zero(),
            game_name:b"y_v's rock_paper_scissors GAME"
        };
        transfer::share_object(game);

        let admin = Admin {id: object::new(ctx)};
        transfer::transfer(admin, ctx.sender());
    }

    public entry fun deposit(game: &mut Game, coin: &mut Coin<FAUCET_COIN>, amount: u64, ctx: &mut TxContext) {
        assert!(coin.value() >= amount, EUserInsufficientBalance);
        let split_balance = coin::balance_mut(coin).split(amount);
        game.balance.join(split_balance);
    }

    public entry fun withdraw(game: &mut Game, _: &Admin, amount: u64, ctx: &mut TxContext) {
        assert!(game.balance.value() >= amount, EGameInsufficientBalance);
        let cash = coin::take(&mut game.balance, amount, ctx);
        transfer::public_transfer(cash, ctx.sender());
    }

    public entry fun Play(game: &mut Game, rnd: &Random, choice: u8, coin: &mut Coin<FAUCET_COIN>, amount: u64, ctx: &mut TxContext) {
        assert!(game.balance.value() >= amount, EGameInsufficientBalance);
        assert!(coin.value() >= amount, EUserInsufficientBalance);

        let mut rand = random::new_generator(rnd, ctx);    
        let ComputerChoice = random::generate_u8(&mut rand) % 3;

        if (
            (choice == 0 && ComputerChoice == 1)
            || (choice == 1 && ComputerChoice == 2)
            || (choice == 2 && ComputerChoice == 0)
        ) {
            //win,you will get reward
            let reward = coin::take(&mut game.balance, amount, ctx);
            coin.join(reward);
        } else if (choice == ComputerChoice) {
            //draw,nothing happen
        } else {
            //lose,lose your coin
            Self::deposit(game, coin, amount,ctx)
        };
    }

}
```


# 一些可能踩到的坑
```
Failed to publish the Move module(s), reason: Package dependency "faucet_coin" does not specify a published address (the Move.toml manifest for "faucet_coin" does not contain a 'published-at' field, nor is there a 'published-id' in the Move.lock).
If this is intentional, you may use the --with-unpublished-dependencies flag to continue publishing these dependencies as part of your package (they won't be linked against existing packages on-chain).
```
如果在部署到测试网时出现这个报错说明那个faucet_coin包部署在主网以至于无法找到对应依赖，可以写一个一样的faucet_coin部署到测试网然后再进行测试，或者能找到之前在测试网部署的包也行