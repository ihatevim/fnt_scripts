import { Ability, dotaunitorder_t, EventsSDK, ExecuteOrder, item_magic_stick, item_power_treads, Menu, Unit } from "./wrapper/Imports"

function GetAvaiilablePTMana(base_mana: number, max_mana: number): number {
	return (max_mana + 120) / max_mana * base_mana
}

const RootMenu = Menu.AddEntryDeep(["Utility", "Mana Abuse"])
const State = RootMenu.AddToggle("State")

EventsSDK.on("PrepareUnitOrders", order => {
	const orders = ExecuteOrder.fromNative()
	if (orders === undefined)
	return true
	const ent = order.Issuers[0],
		abil = order.Ability
	if (
		!State.value
		|| order.Issuers.length !== 1
		|| !(ent instanceof Unit)
		|| (
			order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_NO_TARGET
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET_TREE
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TOGGLE
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_POSITION
		)
		|| !(abil instanceof Ability)
		|| abil.ManaCost === 0
		|| ent.InvisibilityLevel > 0
	)
		return true


	const pt = ent.GetItemByClass(item_power_treads)
	const stick = ent.GetItemByClass(item_magic_stick)
	const mana_per_wand_charge = 15
	let available_mana = ent.Mana,
		use_stick = false,
		manacost = abil.ManaCost
	if (available_mana < manacost) {
		if (GetAvaiilablePTMana(available_mana, ent.MaxMana) >= manacost) {
			available_mana = GetAvaiilablePTMana(available_mana, ent.MaxMana)
		}
		if (stick !== undefined && available_mana < manacost) {
			available_mana += mana_per_wand_charge * stick.CurrentCharges
			use_stick = true
		}

		if (pt !== undefined && available_mana < manacost) {
			available_mana = GetAvaiilablePTMana(available_mana, ent.MaxMana)
		}

	}
		switch (pt!.ActiveAttribute) {
			case 2:
				ent.CastNoTarget(pt!, order.Queue)
			case 0:
				ent.CastNoTarget(pt!, order.Queue)
				break
			default:
				break
		}
		
	if (use_stick)
		ent.CastNoTarget(stick!, order.Queue)
	
	if(ExecuteOrder.queue_user_orders){
		orders.ExecuteQueued()
		return false
	}

	return false

})