The mining and the real time rewards logic
User Reward Per Ms = ((Pool Total Reward / (Total Staked * Reward Duration)) * User Stake) / 1000.
UI Sync: Instead of waiting 30 seconds for an RPC update, the UI uses a 100ms interval to locally increment the reward count based on the calculated emission velocity. This gives the "Super App" that professional, high-activity feel.


When it come to the UI of the manage screen please let's leave the UI as it is as that was given to us by the product designer. What we could do is to add to what was given to us and make it more interactive and dynamic like how the web app's own is

work on the UI of the inidividaul staking assets from the apr formatted and always checking if the limit is reached and if the limit is reached then disable the staking button

Hook Enrichment	

useStakingPool
 returns an emissionVelocity (tokens per second) and isLocked boolean.
Phase 2	Accordion Component	Build ActivePositionAccordion.tsx as a standalone component using the 4-box grid layouts.
Phase 3	Mining Engine	Implement a useMiningRewards(baseAmount, velocity) hook that handles the 100ms UI ticker.
Phase 4	Consistency Check	Match the font weights (Manrope/Inter) and colors exactly to the tiwi-super-app branding.