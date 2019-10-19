require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();

const rp = require('request-promise');
const schedule = require('node-schedule');
const cloudscraper = require('cloudscraper');

const getColors = require('get-image-colors');

Date.prototype.toLocaleDateString = function () {
  return `${this.getFullYear()}年${this.getMonth() + 1}月${this.getDate()}日`;
};

const getItadPlainByName = (json, name) => {
  return json.data.list.filter((list)=>{
    return list.title.trim().toUpperCase() === name.trim().toUpperCase();
  });
}

const getSteamInfoByPlain = (json, plain) => {
  let steam = json.data.list.filter((list)=>{
    return list.plain === plain && list.shop.id === 'steam';
  });
  if(steam.length > 0){
    let steamUrl = steam[0].urls.buy;
    let info = steamUrl.match( /\/(app|sub|bundle|friendsthatplay|gamecards|recommended)\/([0-9]{1,7})/ );
    return info ? {id: parseInt( info[ 2 ], 10 ), type: info[1] }: { id: -1, type: 'null'};
  }
  else return {id: -1, type: 'null'};
}

const itadShops = 'amazonus,bundlestars,chrono,direct2drive,dlgamer,dreamgame,fireflower,gamebillet,gamejolt,gamersgate,gamesplanet,gog,humblestore,humblewidgets,impulse,indiegalastore,indiegamestand,itchio,macgamestore,newegg,origin,paradox,savemi,silagames,squenix,steam,uplay,wingamestore';

let exRateUSDTW = 30;

const exRateUpdate = () => {
  rp(`https://tw.rter.info/capi.php`).then((res)=>{
    exRateUSDTW = Math.round(JSON.parse(res).USDTWD.Exrate * 100) / 100;
  })
}

exRateUpdate();

schedule.scheduleJob('* * 0 * * *', function(){
  exRateUpdate();
});

let embedColor = "#66c0f4";
let embedColorError = '#ff2222';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content && msg.content.substring(0, 6) === '!itad ' && !msg.author.bot) {
    msg.react(client.emojis.get(process.env.LOADING_EMOJI));
    let name = msg.content.split('!itad ')[1];
    let q = encodeURIComponent(name.trim());

    // Get plain
    rp(`https://api.isthereanydeal.com/v01/search/search/?key=${process.env.ITAD_KEY}&q=${q}&offset=&limit=&region=us&country=US&shops=${itadShops}`)
      .then((res)=>{
        let json = JSON.parse(res);
        let find = getItadPlainByName(json, name);
        if(find.length === 0){
          if(json.data.list.length === 0){
            msg.clearReactions().then(()=>{
              msg.react('❌').catch();
            }).catch();
            let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(`找不到符合 ${q} 的遊戲`);
            msg.channel.send(embed);
          }
          else {
            json.data.list.sort((a, b)=>{
              return a.title.length - b.title.length || a.title.localeCompare(b.title);
            });
            msg.clearReactions().then(()=>{
              msg.react('❌').catch();
            }).catch();

            let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(`找不到符合 ${q} 的遊戲，你是不是要找...\n\u200b`);
            
            // j = array index
            let j = 0;
            let addedGames = [];
            // i = max 5 suggestions
            for(let i=0;i<5;i++){
              if(json.data.list[j]) {
                if((j === 0) || (j > 0 && !addedGames.includes(json.data.list[j].title))){
                  addedGames.push(json.data.list[j].title);
                  embed.addField(json.data.list[j].title, `https://isthereanydeal.com/game/${json.data.list[j].plain}`);
                }
                else i--;
              }
              else break;
              j++;
            }
            msg.channel.send(embed);
          }
        }
        else {
          let plain = find[0].plain;
          let appTitle = find[0].title;
          let appInfo = getSteamInfoByPlain(json, plain);

          // get history best
          rp(`https://api.isthereanydeal.com/v01/game/lowest/?key=${process.env.ITAD_KEY}&plains=${plain}&region=us&country=US&shops=${itadShops}`)
            .then((res)=>{
              let lowest = JSON.parse(res).data[plain];
              let lowestDate = new Date(lowest.added*1000);
              
              // get current best
              rp(`https://api.isthereanydeal.com/v01/game/prices/?key=${process.env.ITAD_KEY}&plains=${plain}&region=us&country=US&shops=${itadShops}`)
                .then((res)=>{
                  let current = JSON.parse(res).data[plain].list[0];
                  let replyTextDeal = 
                    `原價: ${current.price_old} USD / ${Math.round(current.price_old*exRateUSDTW*100)/100} TWD\n` +
                    `目前最低: ${current.price_new} USD / ${Math.round(current.price_new*exRateUSDTW*100)/100} TWD, -${current.price_cut}%, 在 ${current.shop.name}\n` +
                    `歷史最低: ${lowest.price} USD / ${Math.round(lowest.price*exRateUSDTW*100)/100} TWD, -${lowest.cut}%, ${lowestDate.toLocaleDateString()} 在 ${lowest.shop.name}\n` +
                    `${current.url}\n`;
                  
                  let replyTextSteam = '';

                  let replyTextInfo = `https://isthereanydeal.com/game/${plain}/info/\n`;
                  
                  // is steam
                  if(appInfo.id != -1) {
                    replyTextInfo += `https://store.steampowered.com/${appInfo.type}/${appInfo.id}/\n` + 
                                    `https://steamdb.info/${appInfo.type}/${appInfo.id}/`;

                    // get twd info
                    if(appInfo.type === 'app'){
                      let replyImage = `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.id}/header.jpg`;
                      let embedColorApp = embedColor;
                      getColors(replyImage).then(colors => {
                        colors = colors.map(color => color.hex());
                        embedColorApp = colors[0];
                      })

                      rp(`http://store.steampowered.com/api/appdetails/?appids=${appInfo.id}&cc=tw&filters=price_overview`)
                        .then((res)=>{
                          let appTWPrice = JSON.parse(res);
                          
                          // check ok
                          if(appTWPrice[appInfo.id].success && typeof appTWPrice[appInfo.id].data.length != 'array') {
                            let price_overview = appTWPrice[appInfo.id].data.price_overview;
                            replyTextSteam += `原價: ${price_overview.initial_formatted.length === 0 ? price_overview.final_formatted : price_overview.initial_formatted}, \n` +
                                              `目前價格: ${price_overview.final_formatted}, -${price_overview.discount_percent}%\n`

                            // check steamdb for history low
                            cloudscraper.get(`https://steamdb.info/api/ExtensionGetPrice/?appid=${appInfo.id}&currency=TWD`)
                              .then((res)=>{
                                let json = JSON.parse(res);
                                if(json.success) {
                                  replyTextSteam += `歷史最低: ${json.data.lowest.price}, -${json.data.lowest.discount}%, ${new Date(json.data.lowest.date).toLocaleDateString()}\n`;
                                  msg.clearReactions().then(()=>{
                                    msg.react('✅').catch();
                                  }).catch();
                                  let embed = new Discord.RichEmbed().setColor(embedColorApp).setTitle(appTitle+`\n\u200b`)
                                    .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                                    .addField('Steam', replyTextSteam+`\n\u200b`)
                                    .addField('更多資訊', replyTextInfo+`\n\u200b`)
                                    .setImage(replyImage);
                                  msg.channel.send(embed);
                                }  
                                else {
                                  replyTextSteam += `歷史最低: SteamDB 查詢失敗\n`;
                                  msg.clearReactions().then(()=>{
                                    msg.react('❌').catch();
                                  }).catch();
                                  let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(appTitle+`\n\u200b`)
                                    .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                                    .addField('Steam', replyTextSteam+`\n\u200b`)
                                    .addField('更多資訊', replyTextInfo+`\n\u200b`)
                                    .setImage(replyImage);
                                  msg.channel.send(embed);
                                }
                              })
                              .catch((err)=>{
                                // console.log(err);
                                replyTextSteam += `歷史最低: SteamDB 查詢失敗，請求被對方拒絕\n`;
                                msg.clearReactions().then(()=>{
                                  msg.react('❌').catch();
                                }).catch();
                                let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(appTitle+`\n\u200b`)
                                  .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                                  .addField('Steam', replyTextSteam+`\n\u200b`)
                                  .addField('更多資訊', replyTextInfo+`\n\u200b`)
                                  .setImage(replyImage);
                                msg.channel.send(embed);
                              });
                          }
                          else {
                            replyTextSteam += '目前價格: Steam 查詢失敗\n';
                            msg.clearReactions().then(()=>{
                              msg.react('❌').catch();
                            }).catch();
                            let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(appTitle+`\n\u200b`)
                              .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                              .addField('Steam', replyTextSteam+`\n\u200b`)
                              .addField('更多資訊', replyTextInfo+`\n\u200b`)
                              .setImage(replyImage);
                            msg.channel.send(embed);
                          }
                        })
                        .catch((err)=>{
                          // console.log(err);
                          replyTextSteam += '目前價格: Steam 查詢失敗\n'
                          msg.clearReactions().then(()=>{
                            msg.react('❌').catch();
                          }).catch();
                          let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(appTitle+`\n\u200b`)
                            .setThumbnail(replyImage)
                            .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                            .addField('Steam', replyTextSteam+`\n\u200b`)
                            .addField('更多資訊', replyTextInfo);
                          msg.channel.send(embed);
                        })
                    }
                    else if(appInfo.type === 'sub'){
                      rp(`https://store.steampowered.com/api/packagedetails/?packageids=${appInfo.id}&cc=tw`)
                        .then((res)=>{
                          let appTWPrice = JSON.parse(res);
                          if(appTWPrice[appInfo.id].success) {
                            let price = appTWPrice[appInfo.id].data.price
                            replyTextSteam += `原價:  NT$ ${price.initial/100}\n` +
                                              `單買原價:  NT$ ${price.individual/100}\n` +
                                              `目前價格:  NT$ ${price.final/100}, -${price.discount_percent}%\n`;
                            
                            msg.clearReactions().then(()=>{
                              msg.react('✅').catch();
                            }).catch();
                            let embed = new Discord.RichEmbed().setColor(embedColor).setTitle(appTitle+`\n\u200b`)
                              .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                              .addField('Steam', replyTextSteam+`\n\u200b`)
                              .addField('更多資訊', replyTextInfo);
                            msg.channel.send(embed);
                          }
                          else {
                            replyTextSteam += '目前價格: Steam 沒有提供這個組合包的資料\n'
                            msg.clearReactions().then(()=>{
                              msg.react('✅').catch();
                            }).catch();
                            let embed = new Discord.RichEmbed().setColor(embedColor).setTitle(appTitle+`\n\u200b`)
                              .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                              .addField('Steam', replyTextSteam+`\n\u200b`)
                              .addField('更多資訊', replyTextInfo);
                            msg.channel.send(embed);
                          }
                        })
                        .catch((err)=>{
                          // console.log(err);
                          replyTextSteam += '目前價格: Steam 查詢失敗\n'
                          msg.clearReactions().then(()=>{
                            msg.react('❌').catch();
                          }).catch();
                          let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(appTitle+`\n\u200b`)
                            .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                            .addField('Steam', replyTextSteam+`\n\u200b`)
                            .addField('更多資訊', replyTextInfo);
                          msg.channel.send(embed);
                        })
                    }
                    else {
                      replyTextSteam += 'Steam 沒有提供這個組合包的資料\n'
                      msg.clearReactions().then(()=>{
                        msg.react('✅').catch();
                      }).catch();
                      let embed = new Discord.RichEmbed().setColor(embedColor).setTitle(appTitle+`\n\u200b`)
                        .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                        .addField('Steam', replyTextSteam+`\n\u200b`)
                        .addField('更多資訊', replyTextInfo);
                      msg.channel.send(embed);
                    }
                  }
                  else {
                    msg.clearReactions().then(()=>{
                      msg.react('✅').catch();
                    }).catch();
                    let embed = new Discord.RichEmbed().setColor(embedColor).setTitle(appTitle+`\n\u200b`)
                      .addField('isthereanydeal', replyTextDeal+`\n\u200b`)
                      .addField('更多資訊', replyTextInfo);
                    msg.channel.send(embed);
                  }
                })
                .catch((err)=>{
                  // console.log(err);
                  msg.clearReactions().then(()=>{
                    msg.react('❌').catch();
                  }).catch();
                  let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(`IsThereAnyDeal 目前最低價查詢失敗，請再試一次`);
                  msg.channel.send(embed);
                })
            })
            .catch((err)=>{
              // console.log(err);
              msg.clearReactions().then(()=>{
                msg.react('❌').catch();
              }).catch();
              let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(`IsThereAnyDeal 歷史最低價查詢失敗，請再試一次`);
              msg.channel.send(embed);
            })
        }
      })
      .catch((err)=>{
        // console.log(err);
        msg.clearReactions().then(()=>{
          msg.react('❌').catch();
        }).catch();
        let embed = new Discord.RichEmbed().setColor(embedColorError).setTitle(`遊戲資料查詢失敗，請再試一次`);
        msg.channel.send(embed);
      })
  }
});

client.login(process.env.DISCORD_TOKEN);