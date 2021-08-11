// *****************************************************************************
// IMPORTANT: If you update this code then make sure to recompile
// it and update the .json file as well so that they
// remain in sync for consistent test executions.
// With that said, there shouldn't be any reason to recompile this, like ever...
// *****************************************************************************

pragma solidity >=0.7.0;
struct Asset{
    address creator;
    bool isLock;
    uint size;
}
//TODO: DETEMINE CALLDATA VS MEMORY
contract LockAsset {
  //
  mapping (string => Asset) assets;
  function createAsset(string calldata id, uint size) public returns (bool){
      require(size>0);
      //bool assetIsNew
      Asset storage asset = assets[id];
      //asset.size = size;
      asset.creator = msg.sender;
      //asset.isLock = false;
      //assets[id] = asset;
      return true;
  }
  /*function getAsset(string calldata _id) public view returns (Asset memory)
  {
      return assets[_id];
  }*/

  //Don't care if it is already locked
  function lockAsset(string calldata id) public returns(bool){
      bool assetExsist = assets[id].size>0;
      //require(assetExsist);
      if (!assetExsist){
          return true;
      }
      assets[id].isLock = true;
      return true;
  }
  //Don't care if it is already unlocked
  function unLockAsset(string calldata id) public returns(bool){
      //bool assetExsist = assets[msg.sender][_id].size>0;
      //require(assetExsist);
      assets[id].isLock = false;
      return true;
  }
  function deleteAsset(string calldata id) public returns(bool){
      //bool assetExsist = assets[msg.sender][_id].size>0;
      //require(assetExsist);
      //an asset could only be deleted if it is already locked
      //bool assetIsLocked = assets[msg.sender][_id].isLock;
      //require(assetIsLocked);
      delete assets[id];
      return true;
  }

}
