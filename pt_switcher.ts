import { Ability, dotaunitorder_t, Entity, EventsSDK, GameState, item_magic_stick, item_power_treads, Menu, PowerTreadsAttribute, TickSleeper, Unit } from "./wrapper/Imports"

function GetAvaiilablePTMana(base_mana: number, max_mana: number): number {
	return (max_mana + 120) / max_mana * base_mana
}

const RootMenu = Menu.AddEntryDeep(["Utility", "Mana Abuse"])
const State = RootMenu.AddToggle("State")

const last_casted_abils = new Map<Ability, [TickSleeper, number]>()
EventsSDK.on("GameStarted", () => last_casted_abils.clear())
EventsSDK.on("PrepareUnitOrders", order => {
	const abil = order.Ability
	if (
		!State.value
		|| (
			order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_NO_TARGET
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET_TREE
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TOGGLE
			&& order.OrderType !== dotaunitorder_t.DOTA_UNIT_ORDER_CAST_POSITION
		)
		|| !(abil instanceof Ability)
		|| abil.ManaCost === 0
		
	)
		return true
	const ent = order.Issuers.find(issuer => issuer.Spells.includes(abil))
	if (!(ent instanceof Unit) || ent.InvisibilityLevel > 0)
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
	if (pt !== undefined)
		pt.SwitchAttribute(PowerTreadsAttribute.INTELLIGENCE, order.Queue)
	
	if (use_stick)
		ent.CastNoTarget(stick!, order.Queue)
	order.ExecuteQueued()
	let target = order.Target ?? order.Position
	if (target instanceof Entity)
		target = target.Position
	if (pt !== undefined) {
		const sleeper = new TickSleeper()
		let delay = abil.CastPoint * 1000
		switch (order.OrderType) {
			case dotaunitorder_t.DOTA_UNIT_ORDER_CAST_POSITION:
			case dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET:
			case dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET_TREE:
				delay += ent.TurnTime(target)
				break
			default:
				break
		}
		sleeper.Sleep(GameState.AvgPing * 2 + 60 + delay)
		last_casted_abils.set(abil, [sleeper, pt.ActiveAttribute])
	}
	return false

})

EventsSDK.on("Tick", () => {
	if (!State.value)
	  return
	const erased_abils: Ability[] = []
	last_casted_abils.forEach(([sleeper, saved_state], abil) => {
		if (sleeper.Sleeping)
			return
		const ent = abil.Owner
		if (ent === undefined || ent.IsChanneling || ent.IsInAbilityPhase)
			return
		const pt = ent.GetItemByClass(item_power_treads)
		if (pt !== undefined)
			pt.SwitchAttribute(saved_state, false)
		erased_abils.push(abil)
	})
	erased_abils.forEach(abil => last_casted_abils.delete(abil))
})