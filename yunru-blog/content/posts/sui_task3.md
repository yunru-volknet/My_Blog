+++
title = 'sui_task3'
date = 2024-11-14T16:22:46+08:00
draft = false
+++
# 看题目
## 1.提交package id
上一篇说过了
## 2.转账hash
上一篇说过了

# 前置知识
## nft的定义
### display
一种nft的标准
### kiosk
一种交易的标准，是一个在交易时需要遵守的协议
## 能力*4
copy: 值可以被复制
drop: 在作用域范围结束后值可以被丢弃
key: 在全局存储操作中值可以被用为key键
store: 值可以在全局存储中被存储
### 组合(这是一会要用到的神秘妙妙工具)
#### only key
 没有合约写一个专有的转移方法就没办法转移了，可以通过这个实现灵魂绑定nft
或者实现一个仅有特定转移方法的对象
#### key and store
没有合约内部转移方法也可以实现调用官方底层合约转移，外部转移走了


#my_nft
## 思路
首先要定义一个nft struct，然后每次mint_nft都使用这个nft模板，然后url参数是用来确定图片的
entry函数，还是一样，想方便一点就搞一下，个人还是挺喜欢entry的，方便了不少，写起来也不麻烦
## 代码
```
module my_nft::my_nft{
    use std::string;
    use std::string::String;
    use sui::transfer::transfer;
    use sui::tx_context::sender;

    public struct MyNFT has key {
        id:UID,
        name:String,
        image_url:String,
    }

    fun init(ctx: &mut TxContext){
        let nft = MyNFT{
            id:object::new(ctx),
            name:string::utf8(b"yunru NFT"),
            image_url: string::utf8(b"https://th.bing.com/th/id/OIP.ttGXVHEedmY51ZM3yCsU_gAAAA?rs=1&pid=ImgDetMain") ,
        };
        transfer(nft, sender(ctx));

    }

    public entry fun mint_and_transfer_nft(
        image_url: String,
        name:String,
        ctx: &mut TxContext
    ) {
        let id = object::new(ctx);
        let nft = MyNFT {
            id,
            name,
            image_url,
        };
        transfer(nft, sender(ctx));

    }

}
```
# 深入学习
1.为什么无法把nft转移到其他地址？
mint一个nft之后各位可能想把它给传递给别人，但是我们会注意到这个nft无法在钱包里直接transfer给别人，这是因为这个合约里面的nft是中只含有key的object
只有key就是无法使用底层transfer函数的情形，合约里面没有写好的转移的函数就没办法进行转移
如果要可以自由使用transfer或直接在钱包里转移可以使用key+store(看前面的能力部分，说了会用到的嘛)
2.不能在钱包看到是怎么回事？
钱包可能显示不完全，以链上数据为基准，又或者是网络问题，看下是不是网络环境开的不对
3.怎么转移到其他地址？
思路1：
直接把nft改成key+store
```
    public struct MyNFT has key,store {
        id:UID,
        name:String,
        image_url:String,
    }
```
思路2：
自己写一个transfer_nft函数
```
    struct NftTransferEvent has copy, drop {
        object_id: ID,
        from: address,
        to: address,
    }
    public entry fun transfer_nft(
        nft: NFT,
        recipient: address,
        _: &mut TxContext
    ) {
	// 生成包含NFT_ID的`NftTransferEvent`事件
        event::emit(NftTransferEvent {
            object_id: object::id(&nft),
            from: tx_context::sender(_),
            to: recipient,
        });

        transfer::public_transfer(nft, recipient);
    }
```
因为`NFT`没有`store` ability 所以需要一个自定义的转移函数来变更所有权