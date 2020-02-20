TrimpBot = {};
TrimpBot.currentJob = 0;

TrimpBot.foodWeight = 1;
TrimpBot.woodWeight = 1;
TrimpBot.metalWeight = 2;

TrimpBot.bestLevel = game.global.world;
TrimpBot.prevTime = Date.now();
TrimpBot.raceTimes = [];

TrimpBot.autoPortal = false;
TrimpBot.portalLevel = 39;



// Switch between building and trapping depending on if population is at max
TrimpBot.TrapCheck = function() {

    if (game.global.playerGathering == "buildings" || game.global.playerGathering == "trimps" || game.global.playerGathering == "science")
    {
    // Make traps and gather trimps if trimps is very low (< 1000) and we're low on traps (<100)
    // And also ONLY if gathering trimps is faster than current breeding speed. 
    // (game.portal.Bait.level + 1) * 10  > breedSpeed
    // var elem = document.getElementById("trimpsPs");
    // parseInt(elem.innerHTML)
    // parseInt(document.getElementById("trimpsPs").innerHTML)
    // (game.portal.Bait.level + 1) * 10 > parseInt(document.getElementById("trimpsPs").innerHTML)
    
        var queue = game.global.buildingsQueue.length;
        if ((game.resources.trimps.owned < game.resources.trimps.realMax()
            && game.buildings.Trap.owned > 100 && game.resources.trimps.owned < 4000) || (queue < 2 && game.global.challengeActive == "Trapper") )
        {
            setGather('trimps');
        }
        else if ((game.global.trapBuildToggled && game.resources.trimps.owned < 4000) || queue > 1) 
        {
            setGather('buildings');
        } else {
            setGather('science');
        }
    }
    
    if (game.global.challengeActive == "Trapper") {
        TrimpBot.QueueTrap();
    }
}

TrimpBot.Start = function () {
    setTimeout(function(){TrimpBot.loop = setInterval(function(){TrimpBot.Looper();}, 500)});
    
}

TrimpBot.Start();


TrimpBot.Looper = function() {
    TrimpBot.TrapCheck();
    TrimpBot.CheckEquipment();
    TrimpBot.CheckUpgrades();
    TrimpBot.CheckBuildings();
    TrimpBot.CheckJobs();
    TrimpBot.CheckMaps();
    TrimpBot.CheckRace();
    if (game.global.world <= 2) {TrimpBot.NewbieStart();}
    if (TrimpBot.autoPortal) {TrimpBot.CheckPortal();}
    
}

TrimpBot.Stop = function() {
    clearInterval(TrimpBot.loop);
}


TrimpBot.QueueTrap = function() {
    //if there's no trap in the queue
    var queue = game.global.buildingsQueue.length;
    if (queue < 5 && game.buildings.Trap.owned < 20) {
        buyBuilding("Trap");
        cancelTooltip();
    }
    
}

TrimpBot.NewbieStart = function() {
    if (game.resources.trimps.owned < game.resources.trimps.realMax() * 0.9 && game.resources.food.owned > 90 )
    {
        TrimpBot.QueueTrap();
        setGather('buildings');
    }
    
    if (game.buildings.Trap.owned >= 1 && game.resources.trimps.owned < game.resources.trimps.realMax())
    {
        setGather('trimps');
    } else {
        setGather('buildings');
    }
    
    if (!game.upgrades.Bloodlust.done && game.resources.trimps.owned > game.resources.trimps.realMax() * 0.7) {
        fightManual();
    } else if (game.global.pauseFight){
        pauseFight();
    }
    
    if (game.jobs.Farmer.owned < 5) {
        buyJob("Farmer");
    }
    
}

TrimpBot.CheckPortal = function() {
    if (game.global.world == TrimpBot.portalLevel) {
        var timeSince = new Date().getTime() - game.global.portalTime;
        var minutes = Math.floor(timeSince / 60000);
        var helium = game.resources.helium.owned;
        console.log("Portal time! Gained " + helium + " helium in " + minutes + " minutes!");
        portalClicked();
        activateClicked();
        activatePortal();
    }

}

TrimpBot.CheckBuildings = function() {
    for (var b in game.buildings) {
        var building = game.buildings[b];
        if(!building.locked)
        {
            //console.log(b);
            if (TrimpBot.BuildingCostBelowThreshold(b) )
            {
                //console.log("time to buy a " + b + "!");
                message("Beep boop! TrimpsBot queued up a new " + b + "!", "Story");
                buyBuilding(b);
                cancelTooltip();
                return; // only buy one building per bot tick
            } 
        }
    }
}

TrimpBot.BuildingCostBelowThreshold = function(b)
{
    if (b == "Trap") return false;
    var building = game.buildings[b];
    var PriceThreshold = 0.05;
    switch (b)
    {
        case "Barn":
        case "Shed":
        case "Forge":
            PriceThreshold = 0.15; // need 0.25 to work w/o storage perks. 
            break;
        case "Gym":
            if (game.upgrades.Gymystic.done)
                {PriceThreshold = 0.5;}
            break;
        case "Collector":
        case "Warpstation":
            PriceThreshold = 0.5;
            break;
        case "Tribute":
            if (game.global.world > 40) PriceThreshold = 0.5; else PriceThreshold = 0.10;
            break;
        case "Wormhole":
            if (game.global.world < 50) PriceThreshold = 0.01; else PriceThreshold = 0.001;
            break;
        default:
            PriceThreshold = 0.05;
    
    }
    
    // if (b == "Barn" || b == "Shed" || b == "Forge") {
        // PriceThreshold = 0.15;
    // } else {
        // PriceThreshold = 0.05;
    // }
    var price;
    var percentOfTotal;
    for (var cost in building.cost) 
    {
        price = (typeof building.cost[cost] === 'function') ? building.cost[cost]() : building.cost[cost];
        if (typeof price[1] !== 'undefined') price = resolvePow(price, building);
        
        percentOfTotal = price / game.resources[cost].owned;
        //console.log("percent: " + percentOfTotal); 
        // Don't spend above priceTheshold
        if (percentOfTotal > PriceThreshold)
        {
            return false;
        }
        
    }
    return true;
}

TrimpBot.CheckUpgrades = function() {
    for (var u in game.upgrades) {
        var upgrade = game.upgrades[u];
        if (!upgrade.locked)
        {
            //console.log(u)
            if (TrimpBot.UpgradeCostBelowThreshold(u))
            {
                //console.log("Time to upgrade with " + u + "!");
                message("Beep boop! Trimpsbot researched " + u + "!", "Story");
                buyUpgrade(u);
                cancelTooltip();
                document.getElementById("upgradesAlert").innerHTML = "";
                return; //Only buy one upgrade per bot tick
            }
        }
    }
}

TrimpBot.UpgradeCostBelowThreshold = function(u)
{
    var upgrade = game.upgrades[u];
    var PriceThreshold;
    
    for (var cost in upgrade.cost.resources)
    {
        if (cost == "science") 
        {
            PriceThreshold = 0.50;
        } else {
            PriceThreshold = 0.20;
        }
        if(u == "Speedfarming" || u == "Speedlumber" || u == "Speedminer" || u == "Speedscience") {
            PriceThreshold = 0.80;
        }
        if (u == "Gigastation" && game.buildings.Warpstation.owned <= 20) {
            PriceThreshold = 0.02;
        }
        price = upgrade.cost.resources[cost];
        if (typeof price[1] !== 'undefined') price = resolvePow(price, upgrade);
        
        // Equipment has artisanry modifier
        if (upgrade.prestiges) price = Math.ceil(price * (Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level)));
        //console.log(price + cost);
        var percentOfTotal = price / game.resources[cost].owned;
        //console.log(percentOfTotal);
        
        //Check for coordination pop limit so we don't get error spam
        if (u == "Coordination" && (game.resources.trimps.realMax() < (game.resources.trimps.maxSoldiers * 3)))
        {
            return false;
        }
        
        if (percentOfTotal > PriceThreshold)
        {
            return false;
        }
    }
    return true;
}

TrimpBot.CheckEquipment = function() 
{
    for (var e in game.equipment)
    {
        var equipment = game.equipment[e];
        if (!equipment.locked)
        {
            //console.log(e);
            if (TrimpBot.EquipmentCostBelowThreshold(e))
            {
                //console.log("Time to equip a new " + e + "!");
                message("Beep boop! Trimpsbot upgraded our " + e + "!", "Story");
                buyEquipment(e);
                cancelTooltip();
                return; // Only buy one piece of equipment per bot tick
            }
        }
    }
}

TrimpBot.EquipmentCostBelowThreshold = function(e)
{
    var equipment = game.equipment[e];
    var PriceThreshold = 0.05;
    if (equipment.level >= 5) {PriceThreshold = 0.01;}
    
    for (var cost in equipment.cost)
    {
        var price;
        price = parseFloat(getBuildingItemPrice(equipment, cost, true));
        price = Math.ceil(price * (Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level)));
        //console.log(price);
        var percentOfTotal = price / game.resources[cost].owned;
        //console.log(prettify(percentOfTotal * 100) + "%");
        if (percentOfTotal > PriceThreshold)
        {
            return false;
        }
    }
    return true;
    
}

TrimpBot.CheckJobs = function () 
{
    var PriceThreshold = 0.05;
    
    // don't hire trimps if we don't have a breeding population. Mostly unneccessary, but it smooths out the beginning. 
    if (game.resources.trimps.owned < game.resources.trimps.realMax() * 0.5) {
        return;
    }
    //Trainers
    var price = resolvePow(game.jobs.Trainer.cost.food, game.jobs.Trainer);
    var percentOfTotal = price / game.resources['food'].owned;
    if (percentOfTotal < PriceThreshold && !game.jobs.Trainer.locked && TrimpBot.WorkspaceCount() > 0) 
    {
        buyJob('Trainer');
        cancelTooltip();
        message("Beep beep! Trimpsbot hired a trainer!", "Story");
    }
    
    //Explorers
    var price = resolvePow(game.jobs.Explorer.cost.food, game.jobs.Explorer);
    var percentOfTotal = price / game.resources['food'].owned;
    if (percentOfTotal < PriceThreshold && !game.jobs.Explorer.locked && TrimpBot.WorkspaceCount() > 0) 
    {
        buyJob('Explorer');
        cancelTooltip();
        message("Beep beep! Trimpsbot hired an explorer!", "Story");
    }
    
    //Everything Else
    var totalWeight = TrimpBot.foodWeight + TrimpBot.woodWeight + TrimpBot.metalWeight;
    if (game.jobs.Miner.locked) { totalWeight = TrimpBot.foodWeight + TrimpBot.woodWeight; }

    var workers = game.jobs.Farmer.owned + game.jobs.Lumberjack.owned + game.jobs.Miner.owned;
    if (TrimpBot.WorkspaceCount() > 50) {
        numTab(2);
    }
    if (TrimpBot.WorkspaceCount() > 100) {
        numTab(3);
    }
    if (TrimpBot.WorkspaceCount() > 500) {
        numTab(4);
    }
    if (TrimpBot.WorkspaceCount() > 10000) {
        game.global.buyAmt = Math.round(TrimpBot.WorkspaceCount() / 20);
        game.global.lastCustomAmt = game.global.buyAmt;
        numTab(5);
    }
    
    
    if (TrimpBot.WorkspaceCount() > 7) {
        if (game.jobs.Farmer.owned <= (TrimpBot.foodWeight / totalWeight) * workers)
            buyJob("Farmer");
        if (game.jobs.Lumberjack.owned <= (TrimpBot.woodWeight / totalWeight) * workers)
            buyJob("Lumberjack");
        if (game.jobs.Miner.owned <= (TrimpBot.metalWeight / totalWeight) * workers && !game.jobs.Miner.locked)
            buyJob("Miner");
        if (game.jobs.Scientist.owned < 15 * game.global.world && !game.jobs.Scientist.locked && game.global.world < 21)
            buyJob("Scientist");
        cancelTooltip();
    }
    numTab(1);
}

TrimpBot.WorkspaceCount = function () {
    //Total number of employable trimps. 
    return Math.ceil(game.resources.trimps.realMax() / 2) - game.resources.trimps.employed;
}



TrimpBot.CheckRace = function() {
    if (game.global.world == 1) {
        TrimpBot.bestLevel = 1;
    }
    if (game.global.world > TrimpBot.bestLevel) {
        TrimpBot.bestLevel = game.global.world;
        var duration = Date.now() - TrimpBot.prevTime;
        TrimpBot.prevTime = Date.now();
        var efficiency = game.resources.helium.owned / (duration / 1000);
        console.log("Level: " + TrimpBot.bestLevel + " Time: " + duration + " Efficiency: " + efficiency);
        TrimpBot.raceTimes[game.global.world] = duration;
    }

} 

TrimpBot.PrintTimes = function(shortMessage) {
    for (var i = 0; i < TrimpBot.raceTimes.length; i++) {
        if(TrimpBot.raceTimes[i]){
            if(shortMessage){
                console.log(Math.round(TrimpBot.raceTimes[i] / 600)/100);
            } else {
                console.log("Level " + i + " time: " + Math.round(TrimpBot.raceTimes[i] / 600)/100 + " minutes.");
            }
        }
    }

}



// BIGASS MAPS SECTION



TrimpBot.MapRunOffset = -3; // Attempt maps at zone level adjusted by offset
TrimpBot.FreshestMapLevel = 6 - TrimpBot.MapRunOffset;
TrimpBot.FreshMapsCleared = false;

TrimpBot.CheckMaps = function() {

    // In case of portaling, reset map record
    if (game.global.world == 1) 
    {
        TrimpBot.FreshestMapLevel = 6 - TrimpBot.MapRunOffset;
    }
    // Currently running a map
    if (game.global.mapsActive || !game.global.mapsUnlocked || TrimpBot.FreshestMapLevel > game.global.world) 
    {
        return;
    }
    if (game.global.world + TrimpBot.MapRunOffset >= TrimpBot.FreshestMapLevel)
    {
        TrimpBot.FreshMapsCleared = false;
    }
    TrimpBot.RunFreshMap();
}

TrimpBot.RunFreshMap = function() {
    if (!TrimpBot.FreshMapsCleared && TrimpBot.HasFreshMap()){
        var freshMap = TrimpBot.FindFreshLoot();
        if (freshMap) {
            TrimpBot.RunMap(freshMap);
        } else {
            //no fresh loot: go back to world
            if (game.global.preMapsActive)
            {
                mapsClicked();
            }
        }
    }
}


// Check if there is a created map that matches our current world level (or maybe world level-2, for ease of clearing).
TrimpBot.HasFreshMap = function() {
    for (var i = 0; i < game.global.mapsOwnedArray.length; i++)
    {
        if (game.global.mapsOwnedArray[i].level == (game.global.world + TrimpBot.MapRunOffset) && !game.global.mapsOwnedArray[i].noReycle)
        {   
            TrimpBot.FreshestMapLevel = game.global.mapsOwnedArray[i].level;
            return true;
        }
    }
    TrimpBot.CreateFreshMap();
    return false;
}


// Return mapID of the freshest map with loot, or false if there is no loot
TrimpBot.FindFreshLoot = function() {
    // Check created maps
    var itemCount = 0;
    for (var i = 0; i < game.global.mapsOwnedArray.length; i++)
    {
        itemCount = addSpecials(true, true, game.global.mapsOwnedArray[i]);
        if (itemCount > 0 && !game.global.mapsOwnedArray[i].noRecycle)
        {
            return game.global.mapsOwnedArray[i].id;
        }
    }
    
    // Check Bonus maps
    for (var i = 0; i < game.global.mapsOwnedArray.length; i++)
    {
        itemCount = addSpecials(true, true, game.global.mapsOwnedArray[i]);
        if (itemCount > 0 && game.global.mapsOwnedArray[i].noRecycle && game.global.mapsOwnedArray[i].level <= game.global.world + TrimpBot.MapRunOffset && game.global.mapsOwnedArray[i].name != "The Block")
        {
            return game.global.mapsOwnedArray[i].id;
        }
    }
    TrimpBot.FreshMapsCleared = true;
    itemCount = null;
    return false;
}
 
TrimpBot.RunMap = function(mapid) {
    if (!game.global.mapsActive && !game.global.preMapsActive)
    {
        // abandon trimps, switch to maps screen
        game.global.switchToMaps = true;
        mapsClicked();
    }
    selectMap(mapid);
    runMap();
    
    // turn off repeat
    if (game.global.repeatMap)
    {
        repeatClicked();
    }
}

TrimpBot.CreateFreshMap = function() {
    if (!game.global.mapsActive && !game.global.preMapsActive)
    {
        // abandon trimps, switch to maps screen
        game.global.switchToMaps = true;
        mapsClicked();
    }
    incrementMapLevel(TrimpBot.MapRunOffset);
    // adjustMap('size',9); //Ugh. This doesn't actually work to change the size. 
    document.getElementById("sizeAdvMapsRange").value = 9; // max out size modifier
    
    var cost = updateMapCost(true);
	if (game.resources.fragments.owned >= cost)
    {
        buyMap();
    } else {
        TrimpBot.FreshestMapLevel++;
        console.log("Can't afford a new map. We'll try again next zone.");
        //switch to world map
        if (game.global.preMapsActive)
        {
            mapsClicked();
        }
    }
}

function calcHeliumReward(level) {
    level += 1;
    level += ((level - 1) * 100); // 2021
    level = Math.round((level - 1900) / 100); // 1
    level *= 1.35;
    if (level < 0) level = 0; // 1
    var amt = Math.round(1 * Math.pow(1.23, Math.sqrt(level))); // amt == 1
    amt += Math.round(1 * level); // amt == 2
    amt += (amt * game.portal.Looting.level * game.portal.Looting.modifier); // amt == 3.4
    return amt;
}